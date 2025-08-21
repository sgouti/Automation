Feature: Loan Application File Upload and Verification

  Scenario: Successfully upload a loan application and verify its contents
    Given a user is on the loan application upload page
    When the user uploads a file with details from "test-data/loan-details.json"
    Then the application should display the correct loan details
