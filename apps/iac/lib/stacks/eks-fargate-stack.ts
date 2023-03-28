import * as cdk8s from 'cdk8s';
import { AlbStack } from './alb-stack';
import { NginxService } from './nginx-stack';
import { EksFargateLogging } from './logging-stack';
import {
  EndpointAccess,
  FargateCluster,
  KubernetesVersion,
} from 'aws-cdk-lib/aws-eks';
import { CfnJson, Stack, StackProps } from 'aws-cdk-lib';
import {
  AccountRootPrincipal,
  Effect,
  FederatedPrincipal,
  ManagedPolicy,
  PolicyStatement,
  Role,
} from 'aws-cdk-lib/aws-iam';
import { IVpc, SubnetType } from 'aws-cdk-lib/aws-ec2';
import { Bucket, BucketEncryption } from 'aws-cdk-lib/aws-s3';
import { Construct } from 'constructs';
import { KubectlV24Layer } from '@aws-cdk/lambda-layer-kubectl-v24';

export interface EksFargateStackProps extends StackProps {
  vpc: IVpc;
  clusterName?: string;
}

export class EksFargateStack extends Stack {
  constructor(scope: Construct, id: string, props: EksFargateStackProps) {
    super(scope, id, props);

    const { vpc } = props;

    // cluster master role
    const masterRole = new Role(this, 'default-cluster-master-role', {
      assumedBy: new AccountRootPrincipal(),
    });

    // Create a EKS cluster with Fargate profile.
    const cluster = new FargateCluster(this, 'default-cluster', {
      version: KubernetesVersion.V1_24,
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
    // cluster.addManifest('mypod', {
    //   apiVersion: 'v1',
    //   kind: 'Pod',
    //   metadata: { name: 'mypod' },
    //   spec: {
    //     containers: [
    //       {
    //         name: 'hello',
    //         image: 'amazon/amazon-ecs-sample',
    //         ports: [{ containerPort: 8080 }],
    //       },
    //     ],
    //   },
    // });
    // Deploy AWS LoadBalancer Controller onto
    new AlbStack(this, 'default-loadbalancer-controller', {
      ...props,
      eksCluster: cluster,
    });

    // Create the cdk8s app.
    const cdk8sApp = new cdk8s.App();

    // Now we add the cdk8s chart for the actual application workload, here we take the nginx deployment & service as example.
    //
    // First we create an IAM role, which will be associated with the K8S service account for the actual k8s app. Then we
    // can grant permission to that IAM role so that the actual K8S app can access AWS resources as required.
    //
    // Please note the nginx app itself does not really need any access to AWS resources, however we still include the codes of
    // setting up IAM role and K8S service account so you can reuse them in your own use case where the K8S app does need to access
    // AWS resources, such as s3 buckets.
    //
    const k8sAppNameSpace = 'nginx';
    const k8sIngressName = 'api-ingress';
    const k8sAppServiceAccount = 'sa-nginx';
    const conditions = new CfnJson(this, 'ConditionJson', {
      value: {
        [`${cluster.clusterOpenIdConnectIssuer}:aud`]: 'sts.amazonaws.com',
        [`${cluster.clusterOpenIdConnectIssuer}:sub`]: `system:serviceaccount:${k8sAppNameSpace}:${k8sAppServiceAccount}`,
      },
    });

    const iamPrinciple = new FederatedPrincipal(
      cluster.openIdConnectProvider.openIdConnectProviderArn,
      {},
      'sts:AssumeRoleWithWebIdentity'
    ).withConditions({
      StringEquals: conditions,
    });
    const iamRoleForK8sSa = new Role(this, 'nginx-app-sa-role', {
      assumedBy: iamPrinciple,
    });

    // Grant the IAM role S3 permission as an example to show how you can assign Fargate Pod permissions to access AWS resources
    // even though nginx Pod itself does not need to access AWS resources, such as
    // const example_s3_bucket = new Bucket(
    //   this,
    //   'S3BucketToShowGrantPermission',
    //   {
    //     encryption: BucketEncryption.KMS_MANAGED,
    //   }
    // );
    // example_s3_bucket.grantRead(iamRoleForK8sSa);

    // Apart from the permission to access the S3 bucket above, you can also grant permissions of other AWS resources created in this CDK app to such AWS IAM role.
    // Then in the follow-up CDK8S Chart, we will create a K8S Service Account to associate with this AWS IAM role and a nginx K8S deployment to use the K8S SA.
    // As a result, the nginx Pod will have the fine-tuned AWS permissions defined in this AWS IAM role.

    // Now create a Fargate Profile to host customer app which hosting Pods belonging to nginx namespace.
    const customerAppFargateProfile = cluster.addFargateProfile(
      'customer-app-profile',
      {
        selectors: [{ namespace: k8sAppNameSpace }],
        subnetSelection: { subnetType: SubnetType.PRIVATE_WITH_EGRESS },
        vpc: cluster.vpc,
      }
    );

    const loggingIamPolicy = new ManagedPolicy(
      this,
      'eks-fargate-logging-iam-policy',
      {
        statements: [
          new PolicyStatement({
            effect: Effect.ALLOW,
            actions: [
              'logs:CreateLogStream',
              'logs:CreateLogGroup',
              'logs:DescribeLogStreams',
              'logs:PutLogEvents',
            ],
            resources: ['*'],
          }),
        ],
      }
    );
    customerAppFargateProfile.podExecutionRole.addManagedPolicy(
      loggingIamPolicy
    );

    const loggingChart = cluster.addCdk8sChart(
      'eks-fargate-logging',
      new EksFargateLogging(cdk8sApp, 'eks-fargate-logging-chart')
    );

    loggingChart.node.addDependency(customerAppFargateProfile);

    const k8sAppChart = cluster.addCdk8sChart(
      'nginx-app-service',
      new NginxService(cdk8sApp, 'nginx-app-chart', {
        iamRoleForK8sSaArn: iamRoleForK8sSa.roleArn,
        nameSpace: k8sAppNameSpace,
        ingressName: k8sIngressName,
        serviceAccountName: k8sAppServiceAccount,
      })
    );

    k8sAppChart.node.addDependency(customerAppFargateProfile);
  }
}
