
# Azure Load Balancer Uniformity

This project was used to test how uniform the Azure Load Balancer would distribute traffic to multiple backend nodes. The load balancer was not using any session persistence, which means a 5-tuple hash is used: (source IP, source port, destination IP, destination port, and protocol type).

All my tests were run with:
* 3 backend nodes (D1v3, Ubuntu 17.10)
* Azure Load Balancer Basic
* Roughly 30k total connections @ 100/sec

HINT: Use Azure Load Balancer Standard.

## Ephemeral Port Selection

When an output network request is made, the operating system will assign a local port from the ephemeral port range. The range and selection method is operating system dependent and there is a lot of ambiguous information out there on how this is done.

I tested and observed the following to be true:

* macOS High Sierra - the ports are allocated sequentially (ex. 40000, 40001).

* CentOS v6.9 and v7.4, Ubuntu 17.10 - the ports are allocated sequentially by 2s and were always even (ex 40000, 40002).

I was expecting to see Linux kernals use random ephemeral ports, but that was not the case. The documentation online is vague, but it could be that only UDP is randomized.

## Inherent Imperfection

Regardless of the method used there is some imperfection in port selection:

* If letting the operating system decide, other things on the system may be using connections which will change the expected offset from the previous port.

* If selecting ports sequentially, there could be ports that are in use and that connection will be skipped.

* If selecting ports randomly, there could be ports that are in use and that connection will be skipped. In addition, it is possible that the same port is selected more than once, which will cause an imbalance.

Due to this, we should not expect perfect uniformity, but with enough connections we should expect the results to be close.

## Findings

Before I show individual test results, I wanted to reveal the findings:

* As expected, the same 5-tuple always gets routed to the same node.

* The port selection process doesn't matter. The traffic is distributed evenly regardless of how the local port is selected:
  * by the operating system (somewhat sequential)
  * by the application sequentially
  * or randomly

* Traffic being sent from a single source or multiple sources did not matter.

* **Load Balancer Basic**: The traffic is near perfectly uniform most of the time, but every so often, 1 out of the 3 backends would not get new connections for a short period. I am not sure if this is time-sensitive or based on the number of connections. If you run the test for roughly 30k connections there will be several times that a node isn't getting traffic but it could be any of the 3 nodes with no discernable pattern.

* **Load Balancer Standard**: The traffic is near perfectly uniform with no issues.

This chart shows the problem with Load Balancer Basic:

![findings](/images/findings.png)

## False Downtime

If I add the diagnostics logging to the load balancer to see probe health, I do see that there are multiple periods of downtime every hour. However, that doesn't appear to be accurate, but maybe what is causing the issue.

To verify that is inaccurate, I ran the "probe.js" with an interval of 10/sec requests against both port 80 and 81 on all 3 nodes and observed that every single request resulted in a 200. However, notice that there were plenty of probes being down.

![false-downtime](/images/false-downtime.png)

## Calculating Gaps

Improved gap logic was added to address the possibility that specific requests could lag and show as a gap even if other requests were being handled by the node. When the application is terminated using ctrl-C, the gaps will be calculated which can take a minute or two.

To calculate the gaps, the following steps are taken:

1. All requests except the last 1 second are considered.
2. The gap is measured as the number of milliseconds between a successful reply and the next successful request.
3. The gap is reported if it is greater than the GAP parameter (defaults to 10 x INTERVAL).

## Using the Application

This application is written in Node.js, so you must install that first. To install the dependencies:

```bash
npm install
```

To run the server accepting web traffic on port 80 and health probe checks on port 81, do the following:

```bash
sudo WEB_PORT=80 ADMIN_PORT=81 node server
```

To run the client against a load balancer at address 100.100.100.100 with connections made every 10 milliseconds using OS-assigned ports:

```bash
node client --url http://100.100.100.100 --interval 10
```

To run the client against a load balancer at address 100.100.100.100 with connections made every 10 milliseconds using sequentially-assigned ports:

```bash
node client --url http://100.100.100.100 --interval 10 --ephemeral-port 32768
```

To run the client against a load balancer at address 100.100.100.100 with connections made every 10 milliseconds using randomly-assigned ports:

```bash
node client --url http://100.100.100.100 --interval 10 --random
```

To stop the client, simply do a ctrl-C and the summary information will be displayed and gaps calculated.

To run the probe, make sure you have a VM on the same network and do this:

``` bash
node probe --url http://100.100.100.100:81,http://100.100.100.101:81,http://100.100.100.102:81
```

All of the tools will accept --help to show all possible parameters.

## Test Results

Single client on a Mac with OS selected ports (sequential):

![single-mac-source](/images/single-mac-source.png)

Single client on a Mac with the application using sequentially assigned ports:

![single-mac-source-specify-seq](/images/single-mac-source-specify-seq.png)

3 clients on Linux (1 CentOS 6.9, 1 CentOS 7.4, 1 Ubuntu 17.10) with OS selected ports (sequential, evens):

![multiple-linux-source](/images/multiple-linux-source.png)

Single client on Ubuntu 17.10 with the application using sequentially assigned ports:

![single-ubuntu-seq](/images/single-ubuntu-seq.png)

Single client on Ubuntu 17.10 with the application using randomly assigned ports:

![single-ubuntu-rnd](/images/single-ubuntu-rnd.png)

Single client on Ubuntu 17.10 with the application using OS-assigned ports and the improved gap logic versus calling a specific node directly:

![single-ubuntu-gap](/images/single-ubuntu-gap.png)

Single client on a Mac with the application using OS-assigned ports, the improved gap logic, and using Load Balancer Standard.

![single-load-balancer-std](/images/single-load-balancer-std.png)