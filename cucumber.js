module.exports = {
  default: {
    paths: ['features/**/*.feature'],
    require: ['step-definitions/**/*.ts'],
    requireModule: ['ts-node/register'],
    format: [
      'progress-bar',
      'json:reports/cucumber-report.json'
    ],
    publishQuiet: true,
    forceExit: true,
  }
};
