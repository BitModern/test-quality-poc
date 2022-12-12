import { Stack, StackProps } from 'aws-cdk-lib';
import { IVpc } from 'aws-cdk-lib/aws-ec2';
import { Cluster, ContainerImage } from 'aws-cdk-lib/aws-ecs';
import {
  ApplicationLoadBalancedFargateService,
  ApplicationLoadBalancedFargateServiceProps,
  ApplicationLoadBalancedTaskImageOptions,
} from 'aws-cdk-lib/aws-ecs-patterns';
import { Construct } from 'constructs';

export interface EcsStackProps extends StackProps {
  vpc: IVpc;
}

export class EcsStack extends Stack {
  constructor(scope: Construct, id: string, props: EcsStackProps) {
    super(scope, id, props);

    const { vpc } = props;

    const cluster = new Cluster(this, 'gk-cluster', {
      vpc,
    });

    const taskImageOptions: ApplicationLoadBalancedTaskImageOptions = {
      image: ContainerImage.fromRegistry('amazon/amazon-ecs-sample'),
      // image: ContainerImage.fromRegistry('gitlab/gitlab-ee'),
    };

    const serviceProps: ApplicationLoadBalancedFargateServiceProps = {
      cluster: cluster, // Required
      cpu: 512, // Default is 256
      desiredCount: 6, // Default is 1
      taskImageOptions,
      memoryLimitMiB: 2048, // Default is 512
      publicLoadBalancer: true, // Default is false
    };

    // Create a load-balanced Fargate service and make it public
    new ApplicationLoadBalancedFargateService(
      this,
      'gk-fargate-service',
      serviceProps
    );
  }
}
