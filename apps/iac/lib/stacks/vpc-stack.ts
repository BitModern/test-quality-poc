import { Stack, StackProps } from 'aws-cdk-lib';
import { IVpc, Vpc, IpAddresses } from 'aws-cdk-lib/aws-ec2';
import { Construct } from 'constructs';

export class VpcStack extends Stack {
  readonly vpc: IVpc;

  constructor(scope: Construct, id: string, props: StackProps) {
    super(scope, id, props);

    this.vpc = new Vpc(this, `eks-asg-vpc`, {
      ipAddresses: IpAddresses.cidr('10.0.0.0/16'),
      maxAzs: 2,
      enableDnsHostnames: true,
      enableDnsSupport: true,
      vpcName: 'eks-asg-vpc',
    });
  }
}
