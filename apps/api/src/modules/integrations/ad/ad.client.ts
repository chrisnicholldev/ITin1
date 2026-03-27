import ldap from 'ldapjs';
import { getAdRuntimeConfig } from '../../admin/integration-config.service.js';

export interface AdComputer {
  dn: string;
  objectGUID: string;  // hex string
  cn: string;
  dNSHostName?: string;
  operatingSystem?: string;
  operatingSystemVersion?: string;
  description?: string;
  distinguishedName?: string;
  lastLogonTimestamp?: string; // raw Windows FILETIME string
  whenCreated?: string;
  userAccountControl?: string;
}

function parseGUID(buf: Buffer): string {
  // objectGUID is 16 bytes in mixed-endian layout; store as simple hex for uniqueness
  return buf.toString('hex');
}

function getAttribute(entry: ldap.SearchEntry, attr: string): string | undefined {
  const vals = entry.attributes.find((a) => a.type.toLowerCase() === attr.toLowerCase());
  if (!vals || vals.values.length === 0) return undefined;
  const val = vals.values[0];
  if (Buffer.isBuffer(val)) return parseGUID(val);
  return typeof val === 'string' ? val : undefined;
}

export async function getAdComputers(): Promise<AdComputer[]> {
  const cfg = await getAdRuntimeConfig();

  if (!cfg.url) throw new Error('AD URL is not configured');
  if (!cfg.bindDn) throw new Error('AD Bind DN is not configured');
  if (!cfg.bindCredentials) throw new Error('AD bind credentials are not configured');
  if (!cfg.searchBase) throw new Error('AD search base is not configured');

  return new Promise((resolve, reject) => {
    const client = ldap.createClient({ url: cfg.url! });

    client.on('error', (err) => {
      client.destroy();
      reject(new Error(`LDAP connection error: ${err.message}`));
    });

    client.bind(cfg.bindDn!, cfg.bindCredentials!, (bindErr) => {
      if (bindErr) {
        client.destroy();
        return reject(new Error(`LDAP bind failed: ${bindErr.message}`));
      }

      const filter = cfg.computerFilter || '(objectClass=computer)';
      const computers: AdComputer[] = [];

      client.search(
        cfg.searchBase!,
        {
          filter,
          scope: 'sub',
          attributes: [
            'objectGUID', 'cn', 'dNSHostName', 'operatingSystem',
            'operatingSystemVersion', 'description', 'distinguishedName',
            'lastLogonTimestamp', 'whenCreated', 'userAccountControl',
          ],
        },
        (searchErr, searchRes) => {
          if (searchErr) {
            client.destroy();
            return reject(new Error(`LDAP search failed: ${searchErr.message}`));
          }

          searchRes.on('searchEntry', (entry) => {
            const guid = getAttribute(entry, 'objectGUID');
            const cn = getAttribute(entry, 'cn');
            if (!guid || !cn) return; // skip entries without a GUID or name

            computers.push({
              dn: entry.dn.toString(),
              objectGUID: guid,
              cn,
              dNSHostName: getAttribute(entry, 'dNSHostName'),
              operatingSystem: getAttribute(entry, 'operatingSystem'),
              operatingSystemVersion: getAttribute(entry, 'operatingSystemVersion'),
              description: getAttribute(entry, 'description'),
              distinguishedName: getAttribute(entry, 'distinguishedName'),
              lastLogonTimestamp: getAttribute(entry, 'lastLogonTimestamp'),
              whenCreated: getAttribute(entry, 'whenCreated'),
              userAccountControl: getAttribute(entry, 'userAccountControl'),
            });
          });

          searchRes.on('error', (err) => {
            client.destroy();
            reject(new Error(`LDAP search stream error: ${err.message}`));
          });

          searchRes.on('end', () => {
            client.destroy();
            resolve(computers);
          });
        },
      );
    });
  });
}
