// InfluxDB Configuration
const INFLUXDB_CONFIG = {
  url: 'http://localhost:8086',
  token: 'AH8mpJnruV6K3sE4pD_l_jKhdYit3E07GkcdL2iKFx9oZ03n3MnBY5IXPRWAMqp6AExvQNrW_fPLjyLjAfJSpw==',
  org: 'Siddharth',
  bucket: 'playwright1',
};

import { Reporter, TestCase, TestResult, Suite, FullConfig } from '@playwright/test/reporter';
import * as fs from 'fs';
import * as path from 'path';
import { v4 as uuidv4 } from 'uuid';
import { InfluxDB, Point } from '@influxdata/influxdb-client';

interface ConsoleMessage {
  type: string;
  text: string;
  timestamp: string;
}

interface StepData {
  title: string;
  category: string;
  duration: number;
  location?: { file: string; line: number; column: number };
  error?: { message: string; stack?: string; location?: { file: string; line: number; column: number }; code?: string };
}

interface TestResultData {
  startTime: string;
  duration: number;
  status: string;
  errors: any[];
  steps: StepData[];
  attachments: any[];
  consoleMessages: ConsoleMessage[];
}

interface TestData {
  title: string;
  projectName: string;
  status: string;
  duration: number;
  errors: any[];
  results: TestResultData[];
  suiteId: string;
  testId: string;
}

interface SuiteData {
  title: string;
  file: string;
  suiteId: string;
  tests: TestData[];
  suites?: SuiteData[];
}

interface ReporterOptions {
  influxDB?: boolean;
  influxUrl?: string;
  influxToken?: string;
  influxOrg?: string;
  influxBucket?: string;
}

class CustomReporter implements Reporter {
  private project: { name: string; projectId: string } = { name: '', projectId: '' };
  private suites: SuiteData[] = [];
  private runSummary: any = { status: 'unknown', duration: 0, passed: 0, failed: 0, timedOut: 0, flaky: 0, skipped: 0, expected: 0, unexpected: 0, workers: 0, fullyParallel: false };
  private globalErrors: any[] = [];
  private influxClient?: InfluxDB;
  private writeApi?: any;
  private bucket: string;
  private org: string;
  private startTime: Date;
  private influxDBEnabled: boolean;

  constructor(config: FullConfig, options: ReporterOptions = {}) {
    this.influxDBEnabled = options.influxDB ?? false;
    this.startTime = new Date();
    this.org = options.influxOrg || INFLUXDB_CONFIG.org;
    this.bucket = options.influxBucket || INFLUXDB_CONFIG.bucket;

    if (this.influxDBEnabled) {
      const url = options.influxUrl || INFLUXDB_CONFIG.url;
      const token = options.influxToken || INFLUXDB_CONFIG.token;
      this.influxClient = new InfluxDB({ url, token });
      this.writeApi = this.influxClient.getWriteApi(this.org, this.bucket, 'ms');
      this.writeApi.useDefaultTags({ host: 'playwright-tests' });
    }

    this.runSummary.fullyParallel = config.fullyParallel || false;
  }

  onBegin(config: FullConfig, suite: Suite) {
    this.runSummary.workers = config.workers;
    this.runSummary.fullyParallel = config.fullyParallel || false;
    this.project = {
      name: suite.project()?.name || 'unknown',
      projectId: uuidv4(),
    };
    this.processSuites(suite);
  }

  private processSuites(rootSuite: Suite) {
    const testsByFile: { [file: string]: TestCase[] } = {};
    const collectTests = (s: Suite) => {
      for (const test of s.tests) {
        const file = test.location.file || 'unknown';
        if (!testsByFile[file]) {
          testsByFile[file] = [];
        }
        testsByFile[file].push(test);
      }
      s.suites.forEach(collectTests);
    };
    collectTests(rootSuite);

    for (const [file, tests] of Object.entries(testsByFile)) {
      const fileSuite: SuiteData = {
        title: file.split(/[\\/]/).pop() || 'unknown',
        file: file,
        suiteId: uuidv4(),
        tests: tests.map(test => ({
          title: test.title,
          projectName: test.parent.project()?.name || '',
          status: 'unknown',
          duration: 0,
          errors: [],
          results: [],
          suiteId: uuidv4(),
          testId: uuidv4(),
        })),
        suites: [],
      };
      this.suites.push(fileSuite);
    }
  }

  onTestEnd(test: TestCase, result: TestResult) {
    for (const fileSuite of this.suites) {
      const testData = fileSuite.tests.find(t => t.title === test.title);
      if (testData) {
        testData.status = result.status;
        testData.duration = result.duration;
        testData.errors = result.errors;

        // Extract console messages from attachments
        let consoleMessages: ConsoleMessage[] = [];
        const consoleAttachment = result.attachments.find(attachment => attachment.name === 'console-messages');
        if (consoleAttachment && consoleAttachment.body) {
          try {
            consoleMessages = JSON.parse(consoleAttachment.body.toString('utf-8'));
          } catch (error) {
            console.error(`Failed to parse console messages for test ${test.title}:`, error);
          }
        }

        testData.results.push({
          startTime: result.startTime.toISOString(),
          duration: result.duration,
          status: result.status,
          errors: result.errors,
          steps: result.steps.map(step => {
            const stepData: StepData = {
              title: step.title,
              category: step.category,
              duration: step.duration,
            };
            if (step.location) {
              stepData.location = {
                file: step.location.file,
                line: step.location.line,
                column: step.location.column,
              };
            }
            if (step.error && step.error.location) {
              stepData.error = {
                message: step.error.message,
                stack: step.error.stack,
                location: {
                  file: step.error.location.file,
                  line: step.error.location.line,
                  column: step.error.location.column,
                },
                code: step.error.snippet,
              };
            } else if (step.error) {
              stepData.error = {
                message: step.error.message,
                stack: step.error.stack,
              };
            }
            return stepData;
          }),
          attachments: result.attachments,
          consoleMessages: consoleMessages,
        });

        if (['passed', 'failed', 'timedOut', 'skipped', 'flaky'].includes(result.status)) {
          this.runSummary[result.status]++;
        }
        if (result.status === test.expectedStatus) {
          this.runSummary.expected++;
        } else {
          this.runSummary.unexpected++;
        }

        // Write to InfluxDB only if enabled
        if (this.influxDBEnabled && this.writeApi) {
          const suiteTitle = test.location.file?.split(/[\\/]/).pop() || 'unknownitorio';
          const projectName = test.parent.project()?.name || 'unknown';

          // Write test data
          const testPoint = new Point('tests')
            .tag('suite_title', suiteTitle)
            .tag('test_title', test.title)
            .tag('project', projectName)
            .tag('status', result.status)
            .tag('fullyParallel', this.runSummary.fullyParallel.toString())
            .floatField('duration', result.duration || 0.0)
            .stringField('error_message', result.errors.length > 0 ? result.errors[0].message || '' : '')
            .stringField('error_stack', result.errors.length > 0 ? result.errors[0].stack || '' : '')
            .timestamp(new Date(result.startTime));
          this.writeApi.writePoint(testPoint);

          // Write steps
          for (const step of result.steps) {
            const stepPoint = new Point('steps')
              .tag('step_title', step.title)
              .tag('test_title', test.title)
              .tag('category', step.category || 'step')
              .tag('fullyParallel', this.runSummary.fullyParallel.toString())
              .floatField('duration', step.duration || 0.0)
              .stringField('error_message', step.error ? step.error.message || '' : '')
              .stringField('error_code', step.error ? step.error.snippet || '' : '')
              .timestamp(new Date(result.startTime));
            this.writeApi.writePoint(stepPoint);
          }

          // Write console messages
          for (const msg of consoleMessages) {
            const consolePoint = new Point('console_messages')
              .tag('test_title', test.title)
              .tag('project', projectName)
              .tag('type', msg.type)
              .tag('fullyParallel', this.runSummary.fullyParallel.toString())
              .stringField('message', msg.text)
              .timestamp(new Date(msg.timestamp));
            this.writeApi.writePoint(consolePoint);
          }
        }
      }
    }
  }

  async onEnd(result) {
    this.runSummary.status = result.status;
    this.runSummary.duration = result.duration;

    // Write JSON report to reports folder
    const output = {
      project: this.project,
      suites: this.suites,
      logs: [],
      run_summary: this.runSummary,
      global_errors: this.globalErrors,
    };
    const reportsDir = 'reports';
    const fileName = `test-results-${new Date().toISOString().replace(/[:.]/g, '-')}.json`;
    const filePath = path.join(reportsDir, fileName);

    // Ensure the reports folder exists
    fs.mkdirSync(reportsDir, { recursive: true });

    // Write the file
    fs.writeFileSync(filePath, JSON.stringify(output, null, 2));

    // Flush and close InfluxDB write API only if enabled
    if (this.influxDBEnabled && this.writeApi) {
      try {
        await this.writeApi.flush();
        await this.writeApi.close();
        console.log('InfluxDB write API closed successfully');
      } catch (error) {
        console.error('Failed to close InfluxDB write API:', error);
      }
    }
  }

  onError(error) {
    this.globalErrors.push(error);
  }
}

export default CustomReporter;