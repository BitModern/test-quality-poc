import { Construct } from 'constructs';
import { Stack, StackProps } from 'aws-cdk-lib';
import {
  Peer,
  Port,
  SecurityGroup,
  SubnetType,
  Vpc,
} from 'aws-cdk-lib/aws-ec2';
import { ManagedPolicy, Role, ServicePrincipal } from 'aws-cdk-lib/aws-iam';

export class Ec2Stack extends Stack {
  constructor(scope: Construct, id: string, props?: StackProps) {
    super(scope, id, props);

    // 👇 create VPC in which we'll launch the Instance
    const vpc = new Vpc(scope, 'my-cdk-vpc', {
      cidr: '10.0.0.0/16',
      natGateways: 0,
      subnetConfiguration: [
        { name: 'public', cidrMask: 24, subnetType: SubnetType.PUBLIC },
      ],
    });

    // 👇 create Security Group for the Instance
    const webserverSG = new SecurityGroup(scope, 'webserver-sg', {
      vpc,
      allowAllOutbound: true,
    });

    webserverSG.addIngressRule(
      Peer.anyIpv4(),
      Port.tcp(22),
      'allow SSH access from anywhere'
    );

    webserverSG.addIngressRule(
      Peer.anyIpv4(),
      Port.tcp(80),
      'allow HTTP traffic from anywhere'
    );

    webserverSG.addIngressRule(
      Peer.anyIpv4(),
      Port.tcp(443),
      'allow HTTPS traffic from anywhere'
    );

    // 👇 create a Role for the EC2 Instance
    new Role(this, 'webserver-role', {
      assumedBy: new ServicePrincipal('ec2.amazonaws.com'),
      managedPolicies: [
        ManagedPolicy.fromAwsManagedPolicyName('AmazonS3ReadOnlyAccess'),
      ],
    });
  }
}
