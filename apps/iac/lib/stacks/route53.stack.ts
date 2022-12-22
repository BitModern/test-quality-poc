import { Duration, Stack, StackProps } from 'aws-cdk-lib';
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

    this.hostedZone = HostedZone.fromLookup(this, `hosted-zone`, {
      domainName,
    });

    // new ARecord(this, `subdomain`, {
    //   recordName: subdomainName,
    //   zone: this.hostedZone,
    //   target: RecordTarget.fromAlias(new LoadBalancerTarget(loadBalancer)),
    //   ttl: Duration.minutes(1),
    // });
  }
}
