import { AlbStack } from './alb-stack';
import {
  EndpointAccess,
  FargateCluster,
  KubernetesVersion,
} from 'aws-cdk-lib/aws-eks';
import { Stack, StackProps } from 'aws-cdk-lib';
import { AccountRootPrincipal, Role } from 'aws-cdk-lib/aws-iam';
import { IVpc, SubnetType } from 'aws-cdk-lib/aws-ec2';
import { Construct } from 'constructs';
import { KubectlV24Layer } from '@aws-cdk/lambda-layer-kubectl-v24';

export interface EksFargateStackProps extends StackProps {
  vpc: IVpc;
  clusterName?: string;
}

export class EksFargateStack extends Stack {
  readonly alb: AlbStack;
  constructor(scope: Construct, id: string, props: EksFargateStackProps) {
    super(scope, id, props);

    const { vpc } = props;

    // cluster master role
    const masterRole = new Role(this, 'default-cluster-master-role', {
      assumedBy: new AccountRootPrincipal(),
    });

    // Create a EKS cluster with Fargate profile.
    const cluster = new FargateCluster(this, 'default-cluster', {
      version: KubernetesVersion.V1_25,
      mastersRole: masterRole,
      clusterName: props.clusterName,
      outputClusterName: true,
      kubectlLayer: new KubectlV24Layer(this, 'kubectl'),

      // Networking related settings listed below - important in enterprise context.
      endpointAccess: EndpointAccess.PUBLIC, // In Enterprise context, you may want to set it to PRIVATE.
      // kubectlEnvironment: {     // Also if the Enterprise private subnets do not provide implicit internet proxy instead the workloads need to specify https_proxy, then you need to use kubectlEnvironment to set up http_proxy/https_proxy/no_proxy accordingly for the Lambda provissioning EKS cluster behind the scene so that the Lambda can access AWS service APIs via enterprise internet proxy.
      //     https_proxy: "your-enterprise-proxy-server",
      //     http_proxy: "your-enterprise-proxy-server",
      //     no_proxy: "localhost,127.0.0.1,169.254.169.254,.amazonaws.com,websites-should-not-be-accesses-via-proxy-in-your-environment"
      // },
      vpc,
      vpcSubnets: [{ subnetType: SubnetType.PRIVATE_WITH_EGRESS }], // you can also specify the subnets by other attributes
    });

    // apply a kubernetes manifest to the cluster
    cluster.addManifest('mypod', {
      apiVersion: 'v1',
      kind: 'Pod',
      metadata: { name: 'mypod' },
      spec: {
        containers: [
          {
            name: 'hello',
            image: 'amazon/amazon-ecs-sample',
            ports: [{ containerPort: 8080 }],
          },
        ],
      },
    });
    // Deploy AWS LoadBalancer Controller onto
    this.alb = new AlbStack(this, 'default-loadbalancer-controller', {
      ...props,
      eksCluster: cluster,
    });
  }
}
