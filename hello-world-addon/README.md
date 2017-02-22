# Getting started guide

## Setup your AWS Lambda function
1. Signup/Login to your Amazon Web Services account
2. Create a new lambda function 'servicem8-addon-sdk-hello-world-function'
3. Upload index.js to your lambda function

## Authorise ServiceM8 to execute your lambda function
Before ServiceM8 can invoke your Lambda function, you need to grant our AWS account authority to execute the lambda function on your behalf. To do this you need to grant a resource based policy on your lambda function using the following AWS command-line tools command. 

`aws lambda add-permission --region us-west-1 --function-name servicem8-addon-sdk-hello-world-function --statement-id 123 --principal 576043501240 --action lambda:InvokeFunction `

If you do not have have the AWS command-line tools installed, go [here](https://aws.amazon.com/cli/) to find out more on how to install the tools and get started.

## Setup your ServiceM8 developer account and create your addon
1. Signup a ServiceM8 Developer account [here](https://www.servicem8.com/developer-registration)
2. Login, go to StoreConnect and add a new addon 'Hello world'
3. Upload the manifest.json to your new addon
4. Set your addon callback url to your Lambda function ARN (eg. arn:aws:lambda:us-west-1:1234567890:function:servicem8-addon-sdk-hello-world-function )

## Enable the addon on your developer account
1. Go to Settings -> ServiceM8 Addon Store, and switch on your Addon 'Hello world'

## Test the addon
1. Go to Job History, open a job.
2. You should see a new job action menu item 'Hello Action'
3. Tap the Hello action
