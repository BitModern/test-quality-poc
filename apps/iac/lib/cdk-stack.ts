import { App, Stack, StackProps } from 'aws-cdk-lib';
import { CdkEksFargateStack } from './stacks/cdk-eks-fargate-stack';

export class CdkStack extends Stack {
  constructor(scope: App, id: string, props: StackProps) {
    super(scope, id, props);

    new CdkEksFargateStack(scope, 'k8s-app-on-eks-fargate-stack', {
      env: props.env,
      clusterName: 'test-quaility-poc', // if you don't specify the EKS cluster name, CDK will create the name for you.
      // vpcId: "vpc-f73f4e8a",
      // If you speficy an existing vpc-id, then CDK will use this existing VPC to create EKS cluster instead of
      // creating a new VPC. Please note when using an existing VPC, please make sure its private subnets have been tagged with
      // "kubernetes.io/role/internal-elb: 1" as described in https://docs.aws.amazon.com/eks/latest/userguide/network_reqs.html
    });
  }
}
