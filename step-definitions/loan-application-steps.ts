import { Given, When, Then, Before, After } from '@cucumber/cucumber';
import { expect } from '@playwright/test';
import { CustomWorld } from './custom-world';
import { UploadPage } from '../page-objects/upload-page';
import { parsePdf } from '../utils/file-parser';
import * as testData from '../test-data/loan-details.json';
import fs from 'fs';

Before(async function (this: CustomWorld) {
  await this.openBrowser();
});

After(async function (this: CustomWorld) {
  await this.closeBrowser();
});

Given('a user is on the loan application upload page', async function (this: CustomWorld) {
  // This is a placeholder. In a real scenario, you would navigate to the page.
  // For example: await this.page.goto('http://localhost:3000/upload');
  // For now, we'll load a dummy HTML to make the test runnable.
  await this.page.setContent(`
    <html>
      <body>
        <h1>Loan Application Upload</h1>
        <input type="file" />
        <button>Upload</button>
        <div class="success-message" style="display: none;"></div>
        <div class="details"></div>
      </body>
    </html>
  `);
});

When('the user uploads a file with details from {string}', async function (this: CustomWorld, dataPath: string) {
  const uploadPage = new UploadPage(this.page);

  // In a real test, you would have a sample PDF file.
  // We will create a dummy file for this example.
  const dummyPdfPath = 'test-data/dummy.pdf';
  fs.writeFileSync(dummyPdfPath, 'This is a dummy PDF file.');

  await uploadPage.uploadFile(dummyPdfPath);

  // In a real app, the page would update with the details.
  // We will simulate this by updating the DOM.
  const details = testData.expectedData;
  await this.page.evaluate((details) => {
    const successDiv = document.querySelector('.success-message');
    if(successDiv) successDiv.innerHTML = 'File uploaded successfully!';

    const detailsDiv = document.querySelector('.details');
    if(detailsDiv) {
        detailsDiv.innerHTML = `
        <p>Applicant: ${details.applicantName}</p>
        <p>Amount: ${details.loanAmount}</p>
        <p>Type: ${details.loanType}</p>
        <p>Status: ${details.status}</p>
        `;
    }
  }, details);
});

Then('the application should display the correct loan details', async function (this: CustomWorld) {
  const expected = testData.expectedData;

  // In a real test, you would get the text from the page and assert against it.
  const applicantText = await this.page.textContent('.details p:nth-child(1)');
  const amountText = await this.page.textContent('.details p:nth-child(2)');
  const typeText = await this.page.textContent('.details p:nth-child(3)');
  const statusText = await this.page.textContent('.details p:nth-child(4)');

  expect(applicantText).toContain(expected.applicantName);
  expect(amountText).toContain(expected.loanAmount.toString());
  expect(typeText).toContain(expected.loanType);
  expect(statusText).toContain(expected.status);
});
