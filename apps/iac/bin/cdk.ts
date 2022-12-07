#!/usr/bin/env node
import * as cdk from 'aws-cdk-lib';
import { CdkStack } from '../lib/cdk-stack';

// const env = {
//   account: process.env.CDK_DEFAULT_ACCOUNT,
//   region: process.env.CDK_DEFAULT_REGION
// };
const env = {
  account: '014278456228',
  region: 'us-east-1',
  stage: 'dev',
};

const app = new cdk.App();
new CdkStack(app, `${env.stage}-test-quality-poc`, { env });
