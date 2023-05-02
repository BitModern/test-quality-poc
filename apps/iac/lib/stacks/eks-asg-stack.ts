import { Construct } from 'constructs';
import { Duration, Stack, StackProps } from 'aws-cdk-lib';
import {
  AccountRootPrincipal,
  Role,
  ServicePrincipal,
} from 'aws-cdk-lib/aws-iam';
import {
  AlbControllerVersion,
  Cluster,
  EksOptimizedImage,
  EndpointAccess,
  KubernetesManifest,
  KubernetesVersion,
  NodeType,
} from 'aws-cdk-lib/aws-eks';
import {
  InstanceType,
  SecurityGroup,
  IVpc,
  InstanceClass,
  InstanceSize,
  AmazonLinuxImage,
  AmazonLinuxGeneration,
} from 'aws-cdk-lib/aws-ec2';
import {
  AutoScalingGroup,
  UpdatePolicy,
  HealthCheck,
} from 'aws-cdk-lib/aws-autoscaling';
import { ApplicationLoadBalancer } from 'aws-cdk-lib/aws-elasticloadbalancingv2';
import { KubectlV24Layer } from '@aws-cdk/lambda-layer-kubectl-v24';

export interface EksAsgStackProps extends StackProps {
  vpc: IVpc;
}

export class EksAsgStack extends Stack {
  public readonly cluster: Cluster;
  public readonly loadBalancer: ApplicationLoadBalancer;

  constructor(scope: Construct, id: string, props: EksAsgStackProps) {
    super(scope, id, props);

    const stack = Stack.of(this);

    const { vpc } = props;

    // IAM role for our EC2 worker nodes
    const workerRole = new Role(this, `eks-worker-role`, {
      assumedBy: new ServicePrincipal('ec2.amazonaws.com'),
    });

    const securityGroup = new SecurityGroup(this, `eks-security-group`, {
      vpc,
      allowAllOutbound: false,
    });

    // const asg = cluster.addAutoScalingGroupCapacity(`eks-asg-capacity`, {
    //   instanceType: new InstanceType('t3.large'),
    //   minCapacity: 1,
    //   maxCapacity: 3,
    //   // spotPrice: Stack.of(this).region == primaryRegion ? '0.248' : '0.192',
    // });

    const asg = new AutoScalingGroup(this, `eks-autoscaling-group`, {
      vpc,
      securityGroup,
      role: workerRole,
      minCapacity: 1,
      maxCapacity: 4,
      // desiredCapacity: 1,
      instanceType: InstanceType.of(InstanceClass.T3, InstanceSize.MEDIUM),
      machineImage: new AmazonLinuxImage({
        generation: AmazonLinuxGeneration.AMAZON_LINUX_2,
      }),
      updatePolicy: UpdatePolicy.rollingUpdate(),
      healthCheck: HealthCheck.ec2(),
      autoScalingGroupName: 'eks-autoscaling-group',
    });

    const clusterAdmin = new Role(this, `eks-asg-admin-role`, {
      assumedBy: new AccountRootPrincipal(),
      roleName: 'eks-asg-admin-role',
    });

    const cluster = new Cluster(this, `eks-asg-cluster`, {
      clusterName: `eks-asg-cluster`,
      mastersRole: clusterAdmin,
      version: KubernetesVersion.V1_25,
      defaultCapacity: 2,
      kubectlLayer: new KubectlV24Layer(this, 'KubectlLayer'),
      vpc,
    });

    cluster.connections.allowDefaultPortFromAnyIpv4();
    cluster.connectAutoScalingGroupCapacity(asg, {});

    const loadBalancer = new ApplicationLoadBalancer(this, `eks-asg-alb`, {
      vpc,
      internetFacing: true,
      loadBalancerName: 'eks-asg-alb',
    });

    const httpListener = loadBalancer.addListener('httpListener', {
      port: 80,
      open: true,
    });

    httpListener.addTargets('ApplicationSpotFleet', {
      port: 8080,
      targets: [asg],
    });

    const appLabel = { app: 'hello-kubernetes' };

    const deployment = {
      apiVersion: 'apps/v1',
      kind: 'Deployment',
      metadata: { name: 'hello-kubernetes' },
      spec: {
        replicas: 3,
        selector: { matchLabels: appLabel },
        template: {
          metadata: { labels: appLabel },
          spec: {
            containers: [
              {
                name: 'hello-kubernetes',
                image: 'paulbouwer/hello-kubernetes:1.5',
                ports: [{ containerPort: 8080 }],
              },
            ],
          },
        },
      },
    };

    const service = {
      apiVersion: 'v1',
      kind: 'Service',
      metadata: { name: 'hello-kubernetes' },
      spec: {
        type: 'LoadBalancer',
        ports: [{ port: 80, targetPort: 8080 }],
        selector: appLabel,
      },
    };

    new KubernetesManifest(this, 'hello-kub', {
      cluster: cluster,
      manifest: [deployment, service],
    });

    this.cluster = cluster;
    this.loadBalancer = loadBalancer;
  }
}
