import { App, Stack, StackProps } from 'aws-cdk-lib';
import { Route53Stack } from './stacks/route53.stack';
import { VpcStack } from './stacks/vpc-stack';
import { EksAsgStack } from './stacks/eks-asg-stack';

export class CdkStack extends Stack {
  // readonly eksFargateStack: EksFargateStack;
  readonly eksAsgStack: EksAsgStack;
  readonly route53Stack: Route53Stack;
  constructor(scope: App, id: string, props: StackProps) {
    super(scope, id, props);

    const { env } = props;

    const vpcStack = new VpcStack(this, `vpc-stack`, {
      ...props,
      env,
      stackName: 'vpc-stack',
    });

    this.eksAsgStack = new EksAsgStack(this, `eks-stack`, {
      ...props,
      vpc: vpcStack.vpc,
      env,
      stackName: 'eks-asg-stack',
    });

    this.eksAsgStack.addDependency(vpcStack);

    this.route53Stack = new Route53Stack(this, 'route53-stack', {
      ...props,
      domainName: 'testquality.com',
      subdomainName: 'dev-jira',
      cluster: this.eksAsgStack.cluster,
      alb: this.eksAsgStack.loadBalancer,
      env,
      stackName: 'route53-stack',
    });

    this.route53Stack.addDependency(this.eksAsgStack);
  }
}
