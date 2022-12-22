import { App, Stack, StackProps } from 'aws-cdk-lib';
import { EksStack } from './stacks/eks-stack';
import { Route53Stack } from './stacks/route53.stack';

export class CdkStack extends Stack {
  constructor(scope: App, id: string, props: StackProps) {
    super(scope, id, props);

    const eksStack = new EksStack(this, `tq-eks-stack`, {
      ...props,
    });

    new Route53Stack(this, 'tq-route53-stack', {
      ...props,
      domainName: 'testquality.com',
      subdomainName: 'jira-stage',
      cluster: eksStack.cluster,
    });
  }
}
