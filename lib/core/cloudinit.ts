export const CLOUD_INIT_HEADER = '#cloud-config';
import fs from 'fs';
import path from 'path';
import { storagePaths } from '@/lib/config';
import { geniso } from './driver';


export interface SeedOpts {
  instanceId: string;
  hostname: string;
  rootPassword: string;
  sshPublicKeys: string[];
  mac: string;
  ip: string;
  gateway: string;
  netmask: string;
  dns: string[];
}

/** Files written into the per-instance seed dir, then packed with genisoimage. */
export function userData(o: SeedOpts): string {
  const keys = o.sshPublicKeys.length
    ? `ssh_authorized_keys:\n${o.sshPublicKeys.map((k) => `  - ${k}`).join('\n')}`
    : '';
  return `${CLOUD_INIT_HEADER}
hostname: ${o.hostname}
manage_etc_hosts: true
disable_root: false
ssh_pwauth: true
users:
  - name: root
    lock_passwd: false
    ssh_authorized_keys: []
chpasswd:
  expire: false
  users:
    - name: root
      password: ${o.rootPassword}
      type: text
growpart:
  mode: auto
  devices: ['/']
resize_rootfs: true
package_update: true
write_files:
  - path: /etc/ssh/sshd_config.d/95-machina.conf
    content: |
      PermitRootLogin yes
      PasswordAuthentication yes
runcmd:
  - [systemctl, restart, ssh]
${keys}`;
}

export function metaData(o: { instanceId: string; hostname: string }): string {
  return `instance-id: ${o.instanceId}
local-hostname: ${o.hostname}`;
}

export function networkConfig(o: { mac: string; ip: string; gateway: string; netmask: string; dns: string[] }): string {
  return `version: 2
ethernets:
  machina:
    match:
      macaddress: "${o.mac}"
    addresses:
      - ${o.ip}/${maskBits(o.netmask)}
    routes:
      - to: default
        via: ${o.gateway}
    nameservers:
      addresses: [${o.dns.join(', ')}]
`;
}

function maskBits(netmask: string): number {
  return netmask.split('.').reduce((bits, oct) => {
    let n = parseInt(oct, 10).toString(2).padStart(8, '0');
    return bits + (n.match(/1/g)?.length ?? 0);
  }, 0);
}

/**
 * Build the cloud-init seed ISO for an instance. Layout:
 *   <seeds>/<instanceId>/{user-data, meta-data, network-config} -> seed.iso
 * Returns the absolute ISO path. Non-fatal failures throw — provisioning
 * cannot proceed without a seed.
 */
export async function buildSeed(
  o: SeedOpts & { seedIsoPath: string },
): Promise<void> {
  const sp = storagePaths();
  const dir = path.join(sp.seeds, o.instanceId);
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(`${dir}/user-data`, userData(o), { mode: 0o600 });
  fs.writeFileSync(`${dir}/meta-data`, metaData({ instanceId: o.instanceId, hostname: o.hostname }));
  fs.writeFileSync(`${dir}/network-config`,
    networkConfig({ mac: o.mac, ip: o.ip, gateway: o.gateway, netmask: o.netmask, dns: o.dns }),
  );
  await geniso(o.seedIsoPath, dir);
}

export function seedDir(instanceId: string): string {
  return path.join(storagePaths().seeds, instanceId);
}
