import { Duration, RemovalPolicy, Stack, StackProps } from 'aws-cdk-lib';
import {
  Certificate,
  CertificateValidation,
} from 'aws-cdk-lib/aws-certificatemanager';
import { Cluster, FargateCluster } from 'aws-cdk-lib/aws-eks';
import {
  ARecord,
  HostedZone,
  IHostedZone,
  RecordTarget,
} from 'aws-cdk-lib/aws-route53';
import { LoadBalancerTarget } from 'aws-cdk-lib/aws-route53-targets';
import { ApplicationLoadBalancer } from 'aws-cdk-lib/aws-elasticloadbalancingv2';

export interface RouteStackProps extends StackProps {
  domainName: string;
  subdomainName: string;
  cluster: Cluster;
  alb: ApplicationLoadBalancer;
}

export class Route53Stack extends Stack {
  readonly hostedZone: IHostedZone;
  readonly certifate: Certificate;

  constructor(scope: Stack, id: string, props: RouteStackProps) {
    super(scope, id, props);

    const { domainName, subdomainName, cluster, alb } = props;

    this.hostedZone = new HostedZone(this, `hosted-zone`, {
      zoneName: `${subdomainName}.${domainName}`,
    });
    this.hostedZone.applyRemovalPolicy(RemovalPolicy.DESTROY);

    // this.certifate = new Certificate(this, 'MySecureWildcardCert', {
    //   domainName: `*.${domainName}`,
    //   validation: CertificateValidation.fromDns(this.hostedZone),
    // });

    new ARecord(this, `subdomain`, {
      recordName: subdomainName,
      zone: this.hostedZone,
      target: RecordTarget.fromAlias(new LoadBalancerTarget(alb)),
      ttl: Duration.minutes(1),
    });
  }
}
