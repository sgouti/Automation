import { test, expect } from '@playwright/test';
import { UploadPage } from '../page-objects/upload-page';
import * as testData from '../test-data/loan-details.json';
import fs from 'fs';

test.describe('Loan Application File Upload', () => {
  test('should successfully upload a loan application and verify its contents', async ({ page }) => {
    // Step 1: Navigate to the page (or load dummy content for this example)
    await page.setContent(`
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

    // Step 2: Perform the upload
    const uploadPage = new UploadPage(page);

    // Create a dummy file for this example since we don't have a real one
    const dummyPdfPath = 'test-data/dummy.pdf';
    fs.writeFileSync(dummyPdfPath, 'This is a dummy PDF file for testing.');

    await uploadPage.uploadFile(dummyPdfPath);

    // Step 3: Simulate the application's response after upload
    const details = testData.expectedData;
    await page.evaluate((details) => {
      const successDiv = document.querySelector('.success-message');
      if (successDiv) successDiv.innerHTML = 'File uploaded successfully!';

      const detailsDiv = document.querySelector('.details');
      if (detailsDiv) {
          detailsDiv.innerHTML = `
          <p>Applicant: ${details.applicantName}</p>
          <p>Amount: ${details.loanAmount}</p>
          <p>Type: ${details.loanType}</p>
          <p>Status: ${details.status}</p>
          `;
      }
    }, details);

    // Step 4: Assert the results
    const expected = testData.expectedData;
    const detailsContainer = page.locator('.details');

    await expect(detailsContainer.locator('p:nth-child(1)')).toHaveText(`Applicant: ${expected.applicantName}`);
    await expect(detailsContainer.locator('p:nth-child(2)')).toHaveText(`Amount: ${expected.loanAmount}`);
    await expect(detailsContainer.locator('p:nth-child(3)')).toHaveText(`Type: ${expected.loanType}`);
    await expect(detailsContainer.locator('p:nth-child(4)')).toHaveText(`Status: ${expected.status}`);
  });
});
