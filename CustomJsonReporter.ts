import { Reporter, TestCase, TestResult, TestStep, FullConfig, Suite } from '@playwright/test/reporter';
import * as fs from 'fs';
import * as path from 'path';

interface JsonReport {
  startTime: number;
  endTime: number;
  suites: SuiteResult[];
}

interface SuiteResult {
  id: string;
  title: string;
  tests: TestDetail[];  // Changed from TestResult[] to TestDetail[]
  duration: number;
}

interface TestDetail {
  id: string;
  title: string;
  status: string;
  duration: number;
  error?: string;
  steps: StepDetail[];
  screenshots: Screenshot[];
}

interface StepDetail {
  title: string;
  status: string;
  duration: number;
  error?: string;
  method?: string;  // Add method field
}

interface Screenshot {
  path: string;
  base64?: string;
}

class CustomJsonReporter implements Reporter {
  private report: JsonReport;
  private currentSuite: SuiteResult | null = null;
  private currentTest: TestDetail | null = null;
  private readonly outputFile: string;

  constructor() {
    this.report = {
      startTime: Date.now(),
      endTime: 0,
      suites: []
    };
    const resultsDir = path.join(process.cwd(), 'results');
    this.outputFile = path.join(resultsDir, 'test-report.json');
  }

  onBegin(config: FullConfig, suite: Suite) {
    this.report.startTime = Date.now();
  }

  onTestBegin(test: TestCase) {
    this.ensureSuite(test);
    this.currentTest = {
      id: test.id,
      title: test.title,
      status: 'running',
      duration: 0,
      steps: [],
      screenshots: []
    };
  }

  onStepBegin(test: TestCase, result: TestResult, step: TestStep) {
    if (this.currentTest) {
      // Extract method name from step title if it exists
      const methodMatch = step.title.match(/\[Method: (.+?)\]/);
      const method = methodMatch ? methodMatch[1] : undefined;
      
      this.currentTest.steps.push({
        title: step.title,
        status: 'running',
        duration: 0,
        method: method
      });
    }
  }

  onStepEnd(test: TestCase, result: TestResult, step: TestStep) {
    if (this.currentTest) {
      const currentStep = this.currentTest.steps.find(s => s.title === step.title);
      if (currentStep) {
        currentStep.status = step.error ? 'failed' : 'passed';
        currentStep.duration = step.duration;
        currentStep.error = step.error?.message;
      }
    }
  }

  onTestEnd(test: TestCase, result: TestResult) {
    if (this.currentTest && this.currentSuite) {
      this.currentTest.status = result.status;
      this.currentTest.duration = result.duration;
      this.currentTest.error = result.error?.message;

      // Collect screenshots for failed tests
      if (result.status === 'failed' && result.attachments) {
        this.currentTest.screenshots = result.attachments
          .filter(attachment => attachment.contentType.includes('image'))
          .map(screenshot => ({
            path: screenshot.path || '',
            base64: screenshot.body?.toString('base64')
          }));
      }

      this.currentSuite.tests.push(this.currentTest);
      this.currentSuite.duration += result.duration;
      this.currentTest = null;
    }
  }

  async onEnd() {
    this.report.endTime = Date.now();
    await this.saveReport();
  }

  private ensureSuite(test: TestCase) {
    if (!this.currentSuite || this.currentSuite.title !== test.parent.title) {
      this.currentSuite = {
        id: this.generateSuiteId(test.parent.title),
        title: test.parent.title,
        tests: [],
        duration: 0
      };
      this.report.suites.push(this.currentSuite);
    }
  }

  private generateSuiteId(title: string): string {
    return `suite-${Buffer.from(title).toString('base64')}`;
  }

  private async saveReport() {
    try {
      const resultsDir = path.dirname(this.outputFile);
      // Ensure results directory exists
      await fs.promises.mkdir(resultsDir, { recursive: true });
      
      await fs.promises.writeFile(
        this.outputFile,
        JSON.stringify(this.report, null, 2)
      );
      console.log(`JSON report saved to: ${this.outputFile}`);
    } catch (error) {
      console.error('Failed to save JSON report:', error);
    }
  }
}

export default CustomJsonReporter;
