import { Duration, RemovalPolicy, Stack, StackProps } from 'aws-cdk-lib';
import { Cluster } from 'aws-cdk-lib/aws-eks';
import {
  ARecord,
  HostedZone,
  IHostedZone,
  RecordTarget,
} from 'aws-cdk-lib/aws-route53';
import { LoadBalancerTarget } from 'aws-cdk-lib/aws-route53-targets';

export interface RouteStackProps extends StackProps {
  domainName: string;
  subdomainName: string;
  cluster: Cluster;
}

export class Route53Stack extends Stack {
  readonly hostedZone: IHostedZone;

  constructor(scope: Stack, id: string, props: RouteStackProps) {
    super(scope, id, props);

    const { domainName, cluster, subdomainName } = props;

    this.hostedZone = new HostedZone(this, `hosted-zone`, {
      zoneName: domainName,
    });
    this.hostedZone.applyRemovalPolicy(RemovalPolicy.DESTROY);

    // new ARecord(this, `subdomain`, {
    //   recordName: subdomainName,
    //   zone: this.hostedZone,
    //   target: RecordTarget.fromAlias(
    //     new LoadBalancerTarget(cluster.getServiceLoadBalancerAddress('eks-alb'))
    //   ),
    //   ttl: Duration.minutes(1),
    // });
  }
}
