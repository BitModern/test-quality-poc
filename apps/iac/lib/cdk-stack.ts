import { App, Stack, StackProps } from 'aws-cdk-lib';
import { AlbStack } from './stacks/alb-stack';
import { EksFargateStack } from './stacks/eks-fargate-stack';
import { Route53Stack } from './stacks/route53.stack';
import { VpcStack } from './stacks/vpc-stack';

export class CdkStack extends Stack {
  constructor(scope: App, id: string, props: StackProps) {
    super(scope, id, props);

    const { env } = props;

    const vpcStack = new VpcStack(this, `vpc-stack`, { ...props, env });

    const eksFargateStack = new EksFargateStack(this, `eks-stack`, {
      ...props,
      vpc: vpcStack.vpc,
      env,
    });

    // new Route53Stack(this, 'route53-stack', {
    //   ...props,
    //   domainName: 'testquality.com',
    //   subdomainName: 'jira-stage-dev',
    //   cluster: eksFargateStack.cluster,
    //   env,
    // });
  }
}
