import { Construct } from 'constructs';
import { Duration, PhysicalName, Stack, StackProps } from 'aws-cdk-lib';
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
import { InstanceType, SecurityGroup, IVpc } from 'aws-cdk-lib/aws-ec2';
import { AutoScalingGroup, UpdatePolicy } from 'aws-cdk-lib/aws-autoscaling';

export interface EksStackProps extends StackProps {
  vpc: IVpc;
}

export interface EksProps extends StackProps {
  cluster: Cluster;
  vpc: IVpc;
}

export class EksStack extends Stack {
  public readonly cluster: Cluster;

  constructor(scope: Construct, id: string, props: EksStackProps) {
    super(scope, id, props);

    const { vpc } = props;

    // IAM role for our EC2 worker nodes
    const workerRole = new Role(this, `eks-worker-role`, {
      assumedBy: new ServicePrincipal('ec2.amazonaws.com'),
    });

    const securityGroup = new SecurityGroup(this, `eks-security-group`, {
      vpc,
      allowAllOutbound: false,
    });

    const onDemandASG = new AutoScalingGroup(this, `eks-autoscaling-group`, {
      vpc,
      securityGroup,
      role: workerRole,
      minCapacity: 1,
      maxCapacity: 2,
      instanceType: new InstanceType('t3.small'),
      machineImage: new EksOptimizedImage({
        kubernetesVersion: '1.21',
        nodeType: NodeType.STANDARD, // without this, incorrect SSM parameter for AMI is resolved
      }),
      updatePolicy: UpdatePolicy.rollingUpdate(),
    });

    const mastersRole = new Role(this, 'adminRole', {
      assumedBy: new AccountRootPrincipal(),
    });

    this.cluster = new Cluster(this, `eks-cluster`, {
      vpc,
      defaultCapacity: 0, // we want to manage capacity our selves
      version: KubernetesVersion.V1_21,
      albController: {
        version: AlbControllerVersion.V2_4_1,
      },
      endpointAccess: EndpointAccess.PUBLIC_AND_PRIVATE,
      mastersRole,
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
      cluster: this.cluster,
      manifest: [deployment, service],
    });

    this.cluster.connections.allowDefaultPortFromAnyIpv4();
    this.cluster.connectAutoScalingGroupCapacity(onDemandASG, {});

    // const queue = new Queue(this, `eks-queue`, {
    //   visibilityTimeout: Duration.seconds(300),
    // });

    // const topic = new Topic(this, `eks-topic`);

    // topic.addSubscription(new SqsSubscription(queue));
  }

  // createDeployRole(scope: Construct, id: string, cluster: Cluster): Role {
  //   const role = new Role(scope, id, {
  //     roleName: PhysicalName.GENERATE_IF_NEEDED,
  //     assumedBy: new AccountRootPrincipal(),
  //   });
  //   cluster.awsAuth.addMastersRole(role);

  //   return role;
  // }
}
