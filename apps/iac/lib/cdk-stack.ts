import { App, Stack, StackProps } from 'aws-cdk-lib';
import { EksStack } from './stacks/eks-stack';

export class CdkStack extends Stack {
  constructor(scope: App, id: string, props: StackProps) {
    super(scope, id, props);

    new EksStack(scope, `tq-eks-stack`, {
      ...props,
    });
  }
}
