import { Stack, StackProps } from 'aws-cdk-lib';
import { Role, ServicePrincipal } from 'aws-cdk-lib/aws-iam';
import { Construct } from 'constructs';

export class IamStack extends Stack {
  public readonly workerRole: Role;
  constructor(scope: Construct, id: string, props: StackProps) {
    super(scope, id, props);

    // IAM role for our EC2 worker nodes
    this.workerRole = new Role(this, 'EKSWorkerRole', {
      assumedBy: new ServicePrincipal('ec2.amazonaws.com'),
    });
  }
}
