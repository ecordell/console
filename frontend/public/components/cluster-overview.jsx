import * as _ from 'lodash';
import * as React from 'react';
import { Helmet } from 'react-helmet';
import { Link } from 'react-router-dom';

import { coFetch, coFetchJSON } from '../co-fetch';
import { NavTitle, AsyncComponent } from './utils';
import { k8sBasePath } from '../module/k8s';
import { SecurityScanningOverview } from './secscan/security-scan-overview';
import { StartGuide } from './start-guide';
import { Gauge, Status, prometheusBasePath } from './graphs';
import { EventStreamPage } from './events';

const errorStatus = err => {
  if (_.get(err.response, 'ok') === false) {
    return {
      short: '?',
      status: '', // Gray
      long: err.message,
    };
  }
  // Generic network error handling.
  return {
    short: 'ERROR',
    long: err.message,
    status: 'ERROR',
  };
};

const fetchHealth = () => coFetch(`${k8sBasePath}/healthz`)
  .then(response => response.text())
  .then(body => {
    if (body === 'ok') {
      return {short: 'UP', long: 'All good', status: 'OK'};
    }
    return {short: 'ERROR', long: body, status: 'ERROR'};
  })
  .catch(errorStatus);

const fetchTectonicHealth = () => coFetchJSON('health')
  .then(() => ({short: 'UP', long: 'All good', status: 'OK'}))
  .catch(() => ({short: 'ERROR', long: 'The console service cannot be reached', status: 'ERROR'}));

const fetchQuery = (name, q) => coFetchJSON(`${prometheusBasePath}/api/v1/query?query=${encodeURIComponent(q)}`)
  .then(res => {
    const value = parseInt(_.get(res, 'data.result[0].value[1]'), 10) || 0;
    return {
      short: value,
      status: value === 0 ? 'OK' : 'WARN',
      long: name,
    };
  })
  .catch(errorStatus);


const DashboardLink = ({to, id}) => <div className="col-lg-3 text-right" style={{marginTop: 16}}>
  <Link id={id} target="_blank" to={to}>View Dashboard&nbsp;&nbsp;<i className="fa fa-external-link" /></Link>
</div>;


const Graphs = () => <div className="cluster-overview-cell co-m-pane">
  <div className="row">
    <div className="col-lg-9">
      <h4>Cluster Health</h4>
    </div>
    <DashboardLink id="qa_dashboard_k8s_health" to="/grafana/dashboard/db/kubernetes-cluster-health?orgId=1" />
  </div>
  <div className="row">
    <div className="col-lg-3 col-md-6">
      <Status title="Kubernetes API" fetch={fetchHealth} />
    </div>
    <div className="col-lg-3 col-md-6">
      <Status title="Tectonic Console" fetch={fetchTectonicHealth} />
    </div>
    <div className="col-lg-3 col-md-6">
      <Status
        title="Alerts Firing"
        fetch={() => fetchQuery('Alerts', 'sum(ALERTS{alertstate="firing", alertname!="DeadMansSwitch"})')}
        href="/alertmanager/#/alerts" target="_blank" rel="noopener"
      />
    </div>
    <div className="col-lg-3 col-md-6">
      <Status
        title="Crashlooping Pods"
        fetch={() => fetchQuery('Pods', 'count(increase(kube_pod_container_status_restarts[1h]) > 5)')}
        href="/all-namespaces/pods?rowFilter-pod-status=CrashLoopBackOff"
      />
    </div>
  </div>
  <br />

  <div className="row">
    <div className="col-lg-9">
      <h4>Control Plane Status</h4>
    </div>
    <DashboardLink to="/grafana/dashboard/db/kubernetes-control-plane-status?orgId=1" />
  </div>
  <div className="row">
    <div className="col-lg-3 col-md-6">
      <Gauge title="API Servers Up" query={'(sum(up{job="apiserver"} == 1) / count(up{job="apiserver"})) * 100'} invert={true} thresholds={{warn: 15, error: 50}} />
    </div>
    <div className="col-lg-3 col-md-6">
      <Gauge title="Controller Managers Up" query={'(sum(up{job="kube-controller-manager"} == 1) / count(up{job="kube-controller-manager"})) * 100'} invert={true} thresholds={{warn: 15, error: 50}} />
    </div>
    <div className="col-lg-3 col-md-6">
      <Gauge title="Schedulers Up" query={'(sum(up{job="kube-scheduler"} == 1) / count(up{job="kube-scheduler"})) * 100'} invert={true} thresholds={{warn: 15, error: 50}} />
    </div>
    <div className="col-lg-3 col-md-6">
      <Gauge title="API Request Success Rate" query={'sum(rate(apiserver_request_count{code=~"2.."}[5m])) / sum(rate(apiserver_request_count[5m])) * 100'} invert={true} thresholds={{warn: 15, error: 30}} />
    </div>
  </div>
  <br />

  <div className="row">
    <div className="col-lg-9">
      <h4>Capacity Planning</h4>
    </div>
    <DashboardLink to="/grafana/dashboard/db/kubernetes-capacity-planning?orgId=1" />
  </div>
  <div className="row">
    <div className="col-lg-3 col-md-6">
      <Gauge title="CPU Usage" query={'100 - (sum(rate(node_cpu{job="node-exporter",mode="idle"}[2m])) / count(node_cpu{job="node-exporter", mode="idle"})) * 100'} />
    </div>
    <div className="col-lg-3 col-md-6">
      <Gauge title="Memory Usage" query={'((sum(node_memory_MemTotal) - sum(node_memory_MemFree) - sum(node_memory_Buffers) - sum(node_memory_Cached)) / sum(node_memory_MemTotal)) * 100'} />
    </div>
    <div className="col-lg-3 col-md-6">
      <Gauge title="Disk Usage" query={'(sum(node_filesystem_size{device!="rootfs"}) - sum(node_filesystem_free{device!="rootfs"})) / sum(node_filesystem_size{device!="rootfs"}) * 100'} />
    </div>
    <div className="col-lg-3 col-md-6">
      <Gauge title="Pod Usage" query={'100 - (sum(kube_node_status_capacity_pods) - sum(kube_pod_info)) / sum(kube_node_status_capacity_pods) * 100'} />
    </div>
  </div>
</div>;

const AllGraphs = props => <div>
  <Graphs {...props} />
  <br />
  <EventStreamPage {...props} />
</div>;

const LimitedGraphs = props => <div>
  <div className="cluster-overview-cell co-m-pane">
    <div className="row">
      <div className="col-lg-9">
        <h4>Cluster Health</h4>
      </div>
    </div>
    <div className="row">
      <div className="col-lg-3 col-md-6">
        <Status title="Kubernetes API" fetch={fetchHealth} />
      </div>
      <div className="col-lg-3 col-md-6">
        <Status title="Tectonic Console" fetch={fetchTectonicHealth} />
      </div>
    </div>
  </div>
  <br />
  <EventStreamPage {...props} />
</div>;


const permissionedLoader = props => {
  const allGraphs = () => <AllGraphs {...props} />;
  const limitedGraphs = () => <LimitedGraphs {...props} />;
  // Show events list if user lacks permission to view graphs.
  const q = 'sum(ALERTS{alertstate="firing", alertname!="DeadMansSwitch"})';
  return coFetch(`${prometheusBasePath}/api/v1/query?query=${encodeURIComponent(q)}`)
    .then(() => allGraphs)
    .catch(err => {
      if (err.response && err.response.status && err.response.status === 403) {
        return limitedGraphs;
      }
      return allGraphs;
    });
};

export const ClusterOverviewPage = props => {
  return <div className="co-p-cluster">
    <div className="co-p-cluster__body">
      <StartGuide dismissible={true} />
      <Helmet>
        <title>Cluster Status</title>
      </Helmet>
      <NavTitle title="Cluster Status" />
      <AsyncComponent {...props} loader={permissionedLoader} />
      <br />
      <SecurityScanningOverview
        {...props}
        required="SECURITY_LABELLER"
      />
    </div>
  </div>;
};
