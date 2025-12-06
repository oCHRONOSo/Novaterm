"use client";

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useToast } from '@/components/ui/use-toast';

import type { Socket } from 'socket.io-client';

type ConfigFormsProps = {
  socket: Socket | null;
  ip: string;
  defaultTab?: string;
};

export function ConfigForms({ socket, ip, defaultTab = 'webserver' }: ConfigFormsProps) {
  const { push } = useToast();

  // Webserver config
  const [domain, setDomain] = useState('example.com');
  const [folderName, setFolderName] = useState('example');
  const [isSecure, setIsSecure] = useState(false);

  // Certbot config
  const [certDomain, setCertDomain] = useState('');
  const [certEmail, setCertEmail] = useState('');
  const [certWebroot, setCertWebroot] = useState('/var/www/html');
  const [certWebserver, setCertWebserver] = useState('nginx');
  const [revokeDomain, setRevokeDomain] = useState('');
  const [deleteDomain, setDeleteDomain] = useState('');
  const [infoDomain, setInfoDomain] = useState('');
  // Upgrade config (from self-signed to Let's Encrypt)
  const [upgradeDomain, setUpgradeDomain] = useState('');
  const [upgradeEmail, setUpgradeEmail] = useState('');
  const [upgradeFoldername, setUpgradeFoldername] = useState('');

  // WordPress config
  const [wpFolderName, setWpFolderName] = useState('example');

  // Database config
  const [dbName, setDbName] = useState('example');
  const [dbUser, setDbUser] = useState('user');
  const [dbHost, setDbHost] = useState('localhost');
  const [dbPassword, setDbPassword] = useState('user');

  // DNS config
  const [dnsDomain, setDnsDomain] = useState('example.com');
  const [dnsIp, setDnsIp] = useState(ip || '127.0.0.1');

  // DNS Record config
  const [dnsConfFile, setDnsConfFile] = useState('db.example');
  const [recordType, setRecordType] = useState('A');
  const [dnsValue1, setDnsValue1] = useState('');
  const [dnsValue2, setDnsValue2] = useState('');

  // DHCP config
  const [interfaceName, setInterfaceName] = useState('eth0');
  const [subnetIP, setSubnetIP] = useState('192.168.1.0');
  const [subnetMask, setSubnetMask] = useState('24');
  const [dhcpRangeStart, setDhcpRangeStart] = useState('192.168.1.100');
  const [dhcpRangeEnd, setDhcpRangeEnd] = useState('192.168.1.200');
  const [gatewayIP, setGatewayIP] = useState('192.168.1.1');
  const [dhcpDnsIP, setDhcpDnsIP] = useState('8.8.8.8');

  const runScript = (scriptName: string, args: string[] = []) => {
    if (!socket) {
      push({ title: 'Not connected', description: 'Please connect via SSH first', variant: 'destructive' });
      return;
    }
    socket.emit('runScript', { scriptName, args });
    push({ title: 'Script sent', description: `Executing ${scriptName}` });
  };

  const configureWebserver = (type: 'apache' | 'nginx') => {
    const scriptName = type === 'apache' ? 'configuring/configure_apache.sh' : 'configuring/configure_nginx.sh';
    runScript(scriptName, [domain, folderName, isSecure.toString()]);
  };

  const configureWordPress = () => {
    runScript('configuring/configure_wordpress.sh', [wpFolderName]);
  };

  const configureDatabase = () => {
    runScript('configuring/configure_db.sh', [dbName, dbUser, dbPassword, dbHost]);
  };

  const configureDNS = () => {
    runScript('configuring/configure_dns.sh', [dnsIp, dnsDomain]);
  };

  const configureDNSRecord = () => {
    runScript('configuring/configure_dns_record.sh', [dnsConfFile, recordType, dnsValue1, dnsValue2]);
  };

  const configureDHCP = () => {
    runScript('configuring/configure_dhcp.sh', [
      interfaceName,
      subnetIP,
      subnetMask,
      dhcpRangeStart,
      dhcpRangeEnd,
      gatewayIP,
      dhcpDnsIP,
    ]);
  };

  const manageCertbot = (action: string, ...args: string[]) => {
    runScript('configuring/manage_certbot.sh', [action, ...args]);
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Configuration</CardTitle>
        <CardDescription>Configure services on your server</CardDescription>
      </CardHeader>
      <CardContent>
        <Tabs defaultValue={defaultTab} className="w-full">
          <TabsList className="grid w-full grid-cols-5">
            <TabsTrigger value="webserver">Web</TabsTrigger>
            <TabsTrigger value="wordpress">WordPress</TabsTrigger>
            <TabsTrigger value="database">Database</TabsTrigger>
            <TabsTrigger value="dns">DNS</TabsTrigger>
            <TabsTrigger value="dhcp">DHCP</TabsTrigger>
          </TabsList>

          <TabsContent value="webserver" className="space-y-4 mt-4">
            <Tabs defaultValue="config" className="w-full">
              <TabsList>
                <TabsTrigger value="config">Web Server</TabsTrigger>
                <TabsTrigger value="certificates">Certificates (Certbot)</TabsTrigger>
              </TabsList>
              
              <TabsContent value="config" className="space-y-4 mt-4">
                <div className="space-y-2">
                  <Label htmlFor="domain">Domain</Label>
                  <Input
                    id="domain"
                    value={domain}
                    onChange={(e) => setDomain(e.target.value)}
                    placeholder="example.com"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="folder_name">Folder Name</Label>
                  <Input
                    id="folder_name"
                    value={folderName}
                    onChange={(e) => setFolderName(e.target.value)}
                    placeholder="example"
                  />
                </div>
                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="secure"
                    checked={isSecure}
                    onCheckedChange={(checked) => setIsSecure(checked === true)}
                  />
                  <Label htmlFor="secure">Enable HTTPS</Label>
                </div>
                <div className="flex gap-2">
                  <Button onClick={() => configureWebserver('apache')}>Configure Apache</Button>
                  <Button onClick={() => configureWebserver('nginx')}>Configure Nginx</Button>
                </div>
              </TabsContent>

              <TabsContent value="certificates" className="space-y-4 mt-4">
                <div className="space-y-4">
                  <div>
                    <h3 className="text-sm font-semibold mb-3">Obtain Certificate</h3>
                    <div className="space-y-2">
                      <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <Label htmlFor="cert_domain">Domain</Label>
                          <Input
                            id="cert_domain"
                            value={certDomain}
                            onChange={(e) => setCertDomain(e.target.value)}
                            placeholder="example.com"
                          />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="cert_email">Email</Label>
                          <Input
                            id="cert_email"
                            type="email"
                            value={certEmail}
                            onChange={(e) => setCertEmail(e.target.value)}
                            placeholder="admin@example.com"
                          />
                        </div>
                      </div>
                      <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <Label htmlFor="cert_webroot">Webroot Path</Label>
                          <Input
                            id="cert_webroot"
                            value={certWebroot}
                            onChange={(e) => setCertWebroot(e.target.value)}
                            placeholder="/var/www/html"
                          />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="cert_webserver">Web Server</Label>
                          <Select value={certWebserver} onValueChange={setCertWebserver}>
                            <SelectTrigger>
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="nginx">Nginx</SelectItem>
                              <SelectItem value="apache">Apache</SelectItem>
                              <SelectItem value="standalone">Standalone</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                      </div>
                      <Button 
                        onClick={() => manageCertbot('obtain', certDomain, certEmail, certWebroot, certWebserver)}
                        disabled={!certDomain || !certEmail}
                      >
                        Obtain Certificate
                      </Button>
                    </div>
                  </div>

                  <div className="border-t pt-4">
                    <h3 className="text-sm font-semibold mb-3">Upgrade from Self-Signed</h3>
                    <p className="text-xs text-muted-foreground mb-3">
                      If you already configured nginx with HTTPS (self-signed certificate), use this to upgrade to Let&apos;s Encrypt.
                    </p>
                    <div className="space-y-2">
                      <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <Label htmlFor="upgrade_domain">Domain</Label>
                          <Input
                            id="upgrade_domain"
                            value={upgradeDomain}
                            onChange={(e) => setUpgradeDomain(e.target.value)}
                            placeholder="example.com"
                          />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="upgrade_email">Email</Label>
                          <Input
                            id="upgrade_email"
                            type="email"
                            value={upgradeEmail}
                            onChange={(e) => setUpgradeEmail(e.target.value)}
                            placeholder="admin@example.com"
                          />
                        </div>
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="upgrade_foldername">Folder Name (from nginx config)</Label>
                        <Input
                          id="upgrade_foldername"
                          value={upgradeFoldername}
                          onChange={(e) => setUpgradeFoldername(e.target.value)}
                          placeholder="example (same as used in web server config)"
                        />
                        <p className="text-xs text-muted-foreground">
                          The folder name you used when configuring nginx (e.g., if you used &quot;example&quot;, the config file is /etc/nginx/sites-available/example)
                        </p>
                      </div>
                      <Button 
                        onClick={() => manageCertbot('upgrade', upgradeDomain, upgradeEmail, upgradeFoldername)}
                        disabled={!upgradeDomain || !upgradeEmail || !upgradeFoldername}
                        className="w-full"
                      >
                        Upgrade to Let&apos;s Encrypt
                      </Button>
                    </div>
                  </div>

                  <div className="border-t pt-4">
                    <h3 className="text-sm font-semibold mb-3">Certificate Management</h3>
                    <div className="space-y-3">
                      <div className="flex gap-2">
                        <Button 
                          variant="outline" 
                          onClick={() => manageCertbot('renew')}
                        >
                          Renew All Certificates
                        </Button>
                        <Button 
                          variant="outline" 
                          onClick={() => manageCertbot('renew-test')}
                        >
                          Test Renewal (Dry-run)
                        </Button>
                        <Button 
                          variant="outline" 
                          onClick={() => manageCertbot('list')}
                        >
                          List Certificates
                        </Button>
                      </div>
                    </div>
                  </div>

                  <div className="border-t pt-4">
                    <h3 className="text-sm font-semibold mb-3">Certificate Information</h3>
                    <div className="space-y-2">
                      <div className="flex gap-2">
                        <Input
                          value={infoDomain}
                          onChange={(e) => setInfoDomain(e.target.value)}
                          placeholder="example.com"
                          className="flex-1"
                        />
                        <Button 
                          variant="outline"
                          onClick={() => manageCertbot('info', infoDomain)}
                          disabled={!infoDomain}
                        >
                          Get Info
                        </Button>
                      </div>
                    </div>
                  </div>

                  <div className="border-t pt-4">
                    <h3 className="text-sm font-semibold mb-3 text-destructive">Danger Zone</h3>
                    <div className="space-y-3">
                      <div className="space-y-2">
                        <Label htmlFor="revoke_domain">Revoke Certificate</Label>
                        <div className="flex gap-2">
                          <Input
                            id="revoke_domain"
                            value={revokeDomain}
                            onChange={(e) => setRevokeDomain(e.target.value)}
                            placeholder="example.com"
                            className="flex-1"
                          />
                          <Button 
                            variant="outline"
                            className="border-destructive text-destructive hover:bg-destructive hover:text-destructive-foreground"
                            onClick={() => manageCertbot('revoke', revokeDomain)}
                            disabled={!revokeDomain}
                          >
                            Revoke
                          </Button>
                        </div>
                        <p className="text-xs text-muted-foreground">
                          Revokes a certificate and deletes certificate files
                        </p>
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="delete_domain">Delete Certificate</Label>
                        <div className="flex gap-2">
                          <Input
                            id="delete_domain"
                            value={deleteDomain}
                            onChange={(e) => setDeleteDomain(e.target.value)}
                            placeholder="example.com"
                            className="flex-1"
                          />
                          <Button 
                            variant="outline"
                            className="border-destructive text-destructive hover:bg-destructive hover:text-destructive-foreground"
                            onClick={() => manageCertbot('delete', deleteDomain)}
                            disabled={!deleteDomain}
                          >
                            Delete
                          </Button>
                        </div>
                        <p className="text-xs text-muted-foreground">
                          Deletes a certificate configuration (does not revoke)
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              </TabsContent>
            </Tabs>
          </TabsContent>

          <TabsContent value="wordpress" className="space-y-4 mt-4">
            <p className="text-sm text-muted-foreground">
              Specify your WordPress installation folder in /var/www/
            </p>
            <div className="space-y-2">
              <Label htmlFor="wp_folder_name">Folder Name</Label>
              <Input
                id="wp_folder_name"
                value={wpFolderName}
                onChange={(e) => setWpFolderName(e.target.value)}
                placeholder="example"
              />
            </div>
            <Button onClick={configureWordPress}>Configure WordPress</Button>
          </TabsContent>

          <TabsContent value="database" className="space-y-4 mt-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="db_name">Database Name</Label>
                <Input
                  id="db_name"
                  value={dbName}
                  onChange={(e) => setDbName(e.target.value)}
                  placeholder="example"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="db_user">Database User</Label>
                <Input
                  id="db_user"
                  value={dbUser}
                  onChange={(e) => setDbUser(e.target.value)}
                  placeholder="user"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="db_host">Database Host</Label>
                <Input
                  id="db_host"
                  value={dbHost}
                  onChange={(e) => setDbHost(e.target.value)}
                  placeholder="localhost"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="db_password">Password</Label>
                <Input
                  id="db_password"
                  type="password"
                  value={dbPassword}
                  onChange={(e) => setDbPassword(e.target.value)}
                  placeholder="password"
                />
              </div>
            </div>
            <Button onClick={configureDatabase}>Configure Database</Button>
          </TabsContent>

          <TabsContent value="dns" className="space-y-4 mt-4">
            <Tabs defaultValue="server" className="w-full">
              <TabsList>
                <TabsTrigger value="server">DNS Server</TabsTrigger>
                <TabsTrigger value="records">DNS Records</TabsTrigger>
              </TabsList>
              <TabsContent value="server" className="space-y-4 mt-4">
                <div className="space-y-2">
                  <Label htmlFor="dns_domain">Domain</Label>
                  <Input
                    id="dns_domain"
                    value={dnsDomain}
                    onChange={(e) => setDnsDomain(e.target.value)}
                    placeholder="example.com"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="dns_ip">DNS Server IP</Label>
                  <Input
                    id="dns_ip"
                    value={dnsIp}
                    onChange={(e) => setDnsIp(e.target.value)}
                    placeholder="127.0.0.1"
                  />
                </div>
                <Button onClick={configureDNS}>Configure DNS</Button>
              </TabsContent>
              <TabsContent value="records" className="space-y-4 mt-4">
                <div className="space-y-2">
                  <Label htmlFor="dns_conf_file">Configuration File</Label>
                  <Input
                    id="dns_conf_file"
                    value={dnsConfFile}
                    onChange={(e) => setDnsConfFile(e.target.value)}
                    placeholder="db.example"
                  />
                </div>
                <div className="grid grid-cols-3 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="dns_value_1">Field 1</Label>
                    <Input
                      id="dns_value_1"
                      value={dnsValue1}
                      onChange={(e) => setDnsValue1(e.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="record_type">Record Type</Label>
                    <Select value={recordType} onValueChange={setRecordType}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="A">A</SelectItem>
                        <SelectItem value="AAAA">AAAA</SelectItem>
                        <SelectItem value="CNAME">CNAME</SelectItem>
                        <SelectItem value="MX">MX</SelectItem>
                        <SelectItem value="NS">NS</SelectItem>
                        <SelectItem value="SOA">SOA</SelectItem>
                        <SelectItem value="PTR">PTR</SelectItem>
                        <SelectItem value="TXT">TXT</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="dns_value_2">Field 2</Label>
                    <Input
                      id="dns_value_2"
                      value={dnsValue2}
                      onChange={(e) => setDnsValue2(e.target.value)}
                    />
                  </div>
                </div>
                <Button onClick={configureDNSRecord}>Add Record</Button>
              </TabsContent>
            </Tabs>
          </TabsContent>

          <TabsContent value="dhcp" className="space-y-4 mt-4">
            <Tabs defaultValue="config" className="w-full">
              <TabsList>
                <TabsTrigger value="config">DHCP Configuration</TabsTrigger>
                <TabsTrigger value="leases">Lease Management</TabsTrigger>
              </TabsList>
              <TabsContent value="config" className="space-y-4 mt-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="interface">Interface Name</Label>
                    <Input
                      id="interface"
                      value={interfaceName}
                      onChange={(e) => setInterfaceName(e.target.value)}
                      placeholder="eth0"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="subnet_ip">Subnet IP</Label>
                    <Input
                      id="subnet_ip"
                      value={subnetIP}
                      onChange={(e) => setSubnetIP(e.target.value)}
                      placeholder="192.168.1.0"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="subnet_mask">Subnet Mask</Label>
                    <Input
                      id="subnet_mask"
                      value={subnetMask}
                      onChange={(e) => setSubnetMask(e.target.value)}
                      placeholder="24"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="dhcp_range_start">Range Start</Label>
                    <Input
                      id="dhcp_range_start"
                      value={dhcpRangeStart}
                      onChange={(e) => setDhcpRangeStart(e.target.value)}
                      placeholder="192.168.1.100"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="dhcp_range_end">Range End</Label>
                    <Input
                      id="dhcp_range_end"
                      value={dhcpRangeEnd}
                      onChange={(e) => setDhcpRangeEnd(e.target.value)}
                      placeholder="192.168.1.200"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="gateway_ip">Gateway IP</Label>
                    <Input
                      id="gateway_ip"
                      value={gatewayIP}
                      onChange={(e) => setGatewayIP(e.target.value)}
                      placeholder="192.168.1.1"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="dhcp_dns_ip">DNS Server IP</Label>
                    <Input
                      id="dhcp_dns_ip"
                      value={dhcpDnsIP}
                      onChange={(e) => setDhcpDnsIP(e.target.value)}
                      placeholder="8.8.8.8"
                    />
                  </div>
                </div>
                <Button onClick={configureDHCP}>Configure DHCP</Button>
              </TabsContent>
              <TabsContent value="leases" className="space-y-4 mt-4">
                <p className="text-sm text-muted-foreground">
                  DHCP lease management. Use the scripts below to view or remove leases.
                </p>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    onClick={() => runScript('configuring/remove_lease.sh', [])}
                  >
                    Remove Lease
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => runScript('configuring/remove_lease1.sh', [])}
                  >
                    Remove Lease (Alt)
                  </Button>
                </div>
                <p className="text-xs text-muted-foreground">
                  Note: Viewing active leases requires running commands directly in the terminal.
                </p>
              </TabsContent>
            </Tabs>
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
}

