import json
import os
from datetime import datetime
from influxdb_client import InfluxDBClient, Point, WritePrecision
from influxdb_client.client.write_api import SYNCHRONOUS

# InfluxDB configuration
INFLUX_URL = 'http://localhost:8086'
INFLUX_TOKEN = 'AH8mpJnruV6K3sE4pD_l_jKhdYit3E07GkcdL2iKFx9oZ03n3MnBY5IXPRWAMqp6AExvQNrW_fPLjyLjAfJSpw=='
INFLUX_ORG = 'Siddharth'
INFLUX_BUCKET = 'playwright1'

# Validate configuration
if not INFLUX_TOKEN or not INFLUX_ORG:
    raise ValueError('Missing required InfluxDB configuration. Please set INFLUX_TOKEN and INFLUX_ORG environment variables.')

# Initialize InfluxDB client
client = InfluxDBClient(url=INFLUX_URL, token=INFLUX_TOKEN, org=INFLUX_ORG)
write_api = client.write_api(write_options=SYNCHRONOUS)

def validate_timestamp(timestamp_str: str) -> str:
    """Validate and format timestamp string for InfluxDB"""
    if not timestamp_str:
        return datetime.utcnow().strftime('%Y-%m-%dT%H:%M:%S.%fZ')
    try:
        # Parse the timestamp and ensure it's in the correct format
        dt = datetime.fromisoformat(timestamp_str.replace('Z', '+00:00'))
        return dt.strftime('%Y-%m-%dT%H:%M:%S.%fZ')
    except ValueError:
        return datetime.utcnow().strftime('%Y-%m-%dT%H:%M:%S.%fZ')

def process_suite(suite: dict, parent_suite_title: str = '') -> None:
    """
    Recursively process a suite and its nested suites to extract test results.
    """
    # Combine parent and current suite titles for context
    current_suite_title = f"{parent_suite_title} > {suite['title']}" if parent_suite_title else suite['title']

    # Process specs in the current suite
    for spec in suite.get('specs', []):
        for test in spec.get('tests', []):
            for result in test.get('results', []):
                start_time = validate_timestamp(result.get('startTime', ''))

                point = (
                    Point('test_results')
                    .tag('suite', current_suite_title)
                    .tag('test', spec.get('title', 'unknown'))
                    .tag('status', result.get('status', 'unknown'))
                    .tag('project', test.get('projectName', 'default'))
                    .tag('file', suite.get('file', 'unknown'))
                    .tag('expected_status', test.get('expectedStatus', 'unknown'))
                    .field('duration_ms', int(result.get('duration', 0)))
                    .field('retry', int(result.get('retry', 0)))
                    .field('worker_index', int(result.get('workerIndex', -1)))
                    .field('parallel_index', int(result.get('parallelIndex', -1)))
                    .field('line', int(spec.get('line', 0)))
                    .field('column', int(spec.get('column', 0)))
                    .time(start_time, WritePrecision.MS)
                )

                # Add error message if test failed
                if result.get('status') == 'failed' and 'errors' in result:
                    error_messages = [error.get('message', 'Unknown error') for error in result.get('errors', [])]
                    point.field('error_message', '; '.join(error_messages) if error_messages else 'Unknown error')

                write_api.write(bucket=INFLUX_BUCKET, org=INFLUX_ORG, record=point)

    # Recursively process nested suites
    for nested_suite in suite.get('suites', []):
        process_suite(nested_suite, current_suite_title)

def send_playwright_report_to_influxdb(report_path: str) -> None:
    """
    Send Playwright JSON report to InfluxDB, processing all nested suites.
    """
    try:
        # Read and parse JSON report
        with open(report_path, 'r', encoding='utf-8') as file:
            report = json.load(file)
    except Exception as e:
        raise RuntimeError(f"Failed to read or parse report file: {str(e)}")

    try:
        # Process all top-level suites
        for suite in report.get('suites', []):
            process_suite(suite)

        print('Playwright report successfully sent to InfluxDB')
    except Exception as e:
        raise RuntimeError(f"Error sending data to InfluxDB: {str(e)}")
    finally:
        client.close()

# Configuration for testing purposes
config = {
    'influx_url': INFLUX_URL,
    'org': INFLUX_ORG,
    'bucket': INFLUX_BUCKET
}

if __name__ == '__main__':
    # Example usage
    report_path = './test-results/test-results.json'
    send_playwright_report_to_influxdb(report_path)