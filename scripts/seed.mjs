/**
 * ITin1 demo seed script
 * Usage: node scripts/seed.mjs
 *
 * Seeds realistic demo data for screenshots:
 * locations, vendors, users, categories, assets, racks, networks, vault, tickets, docs, changelog, licenses, contracts
 */

import { MongoClient, ObjectId } from '/home/remote/Documents/Dev/IT/node_modules/.pnpm/mongodb@6.20.0/node_modules/mongodb/lib/index.js';
import { createCipheriv, randomBytes } from 'crypto';
import bcrypt from '/home/remote/Documents/Dev/IT/node_modules/.pnpm/bcryptjs@2.4.3/node_modules/bcryptjs/index.js';

const MONGO_URI = 'mongodb://localhost:27017/itdesk';
const VAULT_KEY = Buffer.from('0a34a60d947653f0d2a6d08f9993d0e9f25f45bf4febb2160e1f2b413064e845', 'hex');

// ── Helpers ───────────────────────────────────────────────────────────────────

function encrypt(plaintext) {
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', VAULT_KEY, iv);
  const encrypted = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  return {
    iv: iv.toString('hex'),
    ciphertext: encrypted.toString('hex'),
    authTag: cipher.getAuthTag().toString('hex'),
  };
}

async function hashPassword(password) {
  return bcrypt.hash(password, 12);
}

function daysFromNow(n) {
  const d = new Date();
  d.setDate(d.getDate() + n);
  return d;
}

function daysAgo(n) {
  return daysFromNow(-n);
}

// ── Main ──────────────────────────────────────────────────────────────────────

const client = new MongoClient(MONGO_URI);
await client.connect();
const db = client.db();
console.log('Connected to MongoDB');

// ── Locations ────────────────────────────────────────────────────────────────

const locIds = {
  hq:     new ObjectId(),
  dc:     new ObjectId(),
  branch: new ObjectId(),
};

await db.collection('locations').deleteMany({});
await db.collection('locations').insertMany([
  { _id: locIds.hq,     name: 'Head Office',       address: '14 Harbour View, Dublin 2', createdAt: new Date(), updatedAt: new Date() },
  { _id: locIds.dc,     name: 'Data Centre',        address: 'Clonshaugh Industrial Estate, Dublin 17', createdAt: new Date(), updatedAt: new Date() },
  { _id: locIds.branch, name: 'Cork Branch Office', address: '3 South Mall, Cork', createdAt: new Date(), updatedAt: new Date() },
]);
console.log('Locations seeded');

// ── Vendors ───────────────────────────────────────────────────────────────────

const vendorIds = {
  dell:    new ObjectId(),
  cisco:   new ObjectId(),
  ms:      new ObjectId(),
  eircom:  new ObjectId(),
  fortinet: new ObjectId(),
};

await db.collection('vendors').deleteMany({});
await db.collection('vendors').insertMany([
  {
    _id: vendorIds.dell, name: 'Dell Technologies', type: 'hardware',
    website: 'https://dell.com', supportPhone: '1800 200 999', supportEmail: 'support@dell.com',
    accountNumber: 'DELL-IE-004821',
    contacts: [{ _id: new ObjectId(), name: 'James Regan', title: 'Account Manager', email: 'jregan@dell.com', phone: '086 123 4567', isPrimary: true }],
    createdAt: new Date(), updatedAt: new Date(),
  },
  {
    _id: vendorIds.cisco, name: 'Cisco Systems', type: 'hardware',
    website: 'https://cisco.com', supportPhone: '1800 CISCO', supportEmail: 'support@cisco.com',
    accountNumber: 'CSC-IE-7723',
    contacts: [{ _id: new ObjectId(), name: 'Aoife Murphy', title: 'Sales Engineer', email: 'amurphy@cisco.com', phone: '01 890 4400', isPrimary: true }],
    createdAt: new Date(), updatedAt: new Date(),
  },
  {
    _id: vendorIds.ms, name: 'Microsoft Ireland', type: 'software',
    website: 'https://microsoft.com/ie', supportPhone: '1890 232 191', supportEmail: 'support@microsoft.com',
    accountNumber: 'MS-EA-IE-20241',
    contacts: [{ _id: new ObjectId(), name: 'Ciaran Doyle', title: 'Licensing Specialist', email: 'cdoyle@microsoft.com', isPrimary: true }],
    createdAt: new Date(), updatedAt: new Date(),
  },
  {
    _id: vendorIds.eircom, name: 'Eircom Business', type: 'isp',
    website: 'https://eircom.ie/business', supportPhone: '1901', supportEmail: 'biz.support@eircom.ie',
    accountNumber: 'EIR-BIZ-558221',
    contacts: [{ _id: new ObjectId(), name: 'Sinead Walsh', title: 'Account Manager', email: 'swalsh@eircom.ie', isPrimary: true }],
    createdAt: new Date(), updatedAt: new Date(),
  },
  {
    _id: vendorIds.fortinet, name: 'Fortinet', type: 'hardware',
    website: 'https://fortinet.com', supportEmail: 'support@fortinet.com',
    contacts: [{ _id: new ObjectId(), name: 'Karl Brennan', title: 'Technical SE', email: 'kbrennan@fortinet.com', isPrimary: true }],
    createdAt: new Date(), updatedAt: new Date(),
  },
]);
console.log('Vendors seeded');

// ── Users ─────────────────────────────────────────────────────────────────────

const userIds = {
  admin:   new ObjectId(),
  tech1:   new ObjectId(),
  tech2:   new ObjectId(),
  user1:   new ObjectId(),
  user2:   new ObjectId(),
};

const pw = await hashPassword('changeme123!');
await db.collection('users').deleteMany({});
await db.collection('users').insertMany([
  {
    _id: userIds.admin, email: 'admin@acme.ie', username: 'admin', displayName: 'Admin',
    passwordHash: pw, authProvider: 'local', role: 'super_admin',
    department: 'IT', title: 'System Administrator',
    isActive: true, twoFactorEnabled: false, createdAt: new Date(), updatedAt: new Date(),
  },
  {
    _id: userIds.tech1, email: 'sarah.kelly@acme.ie', username: 'sarah.kelly', displayName: 'Sarah Kelly',
    passwordHash: pw, authProvider: 'local', role: 'it_admin',
    department: 'IT', title: 'IT Manager',
    phone: '086 555 0101', isActive: true, twoFactorEnabled: false, createdAt: new Date(), updatedAt: new Date(),
  },
  {
    _id: userIds.tech2, email: 'mark.byrne@acme.ie', username: 'mark.byrne', displayName: 'Mark Byrne',
    passwordHash: pw, authProvider: 'local', role: 'it_technician',
    department: 'IT', title: 'IT Technician',
    phone: '087 444 0202', isActive: true, twoFactorEnabled: false, createdAt: new Date(), updatedAt: new Date(),
  },
  {
    _id: userIds.user1, email: 'paul.nolan@acme.ie', username: 'paul.nolan', displayName: 'Paul Nolan',
    passwordHash: pw, authProvider: 'local', role: 'end_user',
    department: 'Finance', title: 'Finance Manager',
    phone: '01 234 5678', isActive: true, twoFactorEnabled: false, createdAt: new Date(), updatedAt: new Date(),
  },
  {
    _id: userIds.user2, email: 'emma.quinn@acme.ie', username: 'emma.quinn', displayName: 'Emma Quinn',
    passwordHash: pw, authProvider: 'local', role: 'end_user',
    department: 'Operations', title: 'Operations Lead',
    phone: '087 333 9090', isActive: true, twoFactorEnabled: false, createdAt: new Date(), updatedAt: new Date(),
  },
]);
console.log('Users seeded');

// ── Ticket Categories ─────────────────────────────────────────────────────────

const catIds = {
  hardware:  new ObjectId(),
  software:  new ObjectId(),
  network:   new ObjectId(),
  access:    new ObjectId(),
};

await db.collection('categories').deleteMany({});
await db.collection('categories').insertMany([
  { _id: catIds.hardware, name: 'Hardware',         defaultPriority: 'medium', createdAt: new Date(), updatedAt: new Date() },
  { _id: catIds.software, name: 'Software',         defaultPriority: 'low',    createdAt: new Date(), updatedAt: new Date() },
  { _id: catIds.network,  name: 'Network / Connectivity', defaultPriority: 'high',   createdAt: new Date(), updatedAt: new Date() },
  { _id: catIds.access,   name: 'Access & Accounts',defaultPriority: 'medium', createdAt: new Date(), updatedAt: new Date() },
]);
console.log('Categories seeded');

// ── Assets ────────────────────────────────────────────────────────────────────

const assetIds = {
  fw01:   new ObjectId(),
  sw01:   new ObjectId(),
  sw02:   new ObjectId(),
  sw03:   new ObjectId(),
  srv01:  new ObjectId(),
  srv02:  new ObjectId(),
  srv03:  new ObjectId(),
  nas01:  new ObjectId(),
  ap01:   new ObjectId(),
  ap02:   new ObjectId(),
  lap01:  new ObjectId(),
  lap02:  new ObjectId(),
  lap03:  new ObjectId(),
  ws01:   new ObjectId(),
  printer1: new ObjectId(),
};

await db.collection('assets').deleteMany({});
await db.collection('assets').insertMany([
  // Firewall
  {
    _id: assetIds.fw01, assetTag: 'NET-001', name: 'FW-HQ-01', type: 'firewall', status: 'active',
    manufacturer: 'Fortinet', modelName: 'FortiGate 100F', serialNumber: 'FGT100F-A2F39B1',
    location: 'Data Centre', vendorId: vendorIds.fortinet,
    purchaseDate: new Date('2023-03-15'), warrantyExpiry: daysFromNow(365),
    purchaseCost: 4200,
    network: { ipAddress: '10.0.0.1', macAddress: '00:0C:29:FG:01:01' },
    notes: 'Primary perimeter firewall. HA pair planned for Q3.',
    customFields: {}, createdAt: new Date(), updatedAt: new Date(),
  },
  // Core switch
  {
    _id: assetIds.sw01, assetTag: 'NET-002', name: 'SW-DC-CORE-01', type: 'switch', status: 'active',
    manufacturer: 'Cisco', modelName: 'Catalyst 9300-48P', serialNumber: 'CAT9K-00A4F2C1',
    location: 'Data Centre', vendorId: vendorIds.cisco,
    purchaseDate: new Date('2023-03-15'), warrantyExpiry: daysFromNow(730),
    purchaseCost: 8500,
    network: { ipAddress: '10.0.1.2', vlan: 1 },
    notes: '48-port PoE core switch. Stack member 1.',
    customFields: {}, createdAt: new Date(), updatedAt: new Date(),
  },
  {
    _id: assetIds.sw02, assetTag: 'NET-003', name: 'SW-HQ-ACC-01', type: 'switch', status: 'active',
    manufacturer: 'Cisco', modelName: 'Catalyst 9200-24P', serialNumber: 'CAT92-00B3D1F2',
    location: 'Head Office', vendorId: vendorIds.cisco,
    purchaseDate: new Date('2023-06-01'), warrantyExpiry: daysFromNow(500),
    purchaseCost: 3200,
    network: { ipAddress: '10.0.2.2', vlan: 10 },
    customFields: {}, createdAt: new Date(), updatedAt: new Date(),
  },
  {
    _id: assetIds.sw03, assetTag: 'NET-004', name: 'SW-CRK-01', type: 'switch', status: 'active',
    manufacturer: 'Cisco', modelName: 'SG350-28', serialNumber: 'SG350-CRK-0043',
    location: 'Cork Branch Office', vendorId: vendorIds.cisco,
    purchaseDate: new Date('2022-11-10'), warrantyExpiry: daysFromNow(120),
    purchaseCost: 1100,
    network: { ipAddress: '10.1.0.2', vlan: 20 },
    customFields: {}, createdAt: new Date(), updatedAt: new Date(),
  },
  // Servers
  {
    _id: assetIds.srv01, assetTag: 'SRV-001', name: 'SRV-DC-FILE-01', type: 'server', status: 'active',
    manufacturer: 'Dell', modelName: 'PowerEdge R750', serialNumber: 'DPE-R750-0091A3',
    location: 'Data Centre', vendorId: vendorIds.dell,
    purchaseDate: new Date('2023-01-20'), warrantyExpiry: daysFromNow(900),
    purchaseCost: 12500,
    specs: { cpu: 'Intel Xeon Silver 4314 (2x)', ram: '128 GB DDR4', storage: '4x 2.4TB SAS RAID-5', os: 'Windows Server', osVersion: '2022 Standard', ipAddress: '10.0.1.10' },
    notes: 'Primary file server. DFS namespace \\\\acme.ie\\files.',
    customFields: {}, createdAt: new Date(), updatedAt: new Date(),
  },
  {
    _id: assetIds.srv02, assetTag: 'SRV-002', name: 'SRV-DC-DC-01', type: 'server', status: 'active',
    manufacturer: 'Dell', modelName: 'PowerEdge R650', serialNumber: 'DPE-R650-0055C1',
    location: 'Data Centre', vendorId: vendorIds.dell,
    purchaseDate: new Date('2023-01-20'), warrantyExpiry: daysFromNow(900),
    purchaseCost: 9800,
    specs: { cpu: 'Intel Xeon Silver 4310 (2x)', ram: '64 GB DDR4', storage: '2x 480GB SSD RAID-1', os: 'Windows Server', osVersion: '2022 Standard', ipAddress: '10.0.1.11' },
    notes: 'Primary domain controller. FSMO roles: PDC Emulator, RID Master, Infrastructure Master.',
    customFields: {}, createdAt: new Date(), updatedAt: new Date(),
  },
  {
    _id: assetIds.srv03, assetTag: 'SRV-003', name: 'SRV-DC-APP-01', type: 'server', status: 'active',
    manufacturer: 'Dell', modelName: 'PowerEdge R650', serialNumber: 'DPE-R650-0055C2',
    location: 'Data Centre', vendorId: vendorIds.dell,
    purchaseDate: new Date('2023-06-10'), warrantyExpiry: daysFromNow(1100),
    purchaseCost: 9800,
    specs: { cpu: 'Intel Xeon Silver 4310 (2x)', ram: '128 GB DDR4', storage: '2x 960GB SSD RAID-1', os: 'Ubuntu Server', osVersion: '22.04 LTS', ipAddress: '10.0.1.12' },
    notes: 'Application server running internal web apps + ITin1.',
    customFields: {}, createdAt: new Date(), updatedAt: new Date(),
  },
  {
    _id: assetIds.nas01, assetTag: 'SRV-004', name: 'NAS-DC-01', type: 'other', status: 'active',
    manufacturer: 'Synology', modelName: 'RS1221+', serialNumber: 'SYN-RS1221-AA04',
    location: 'Data Centre',
    purchaseDate: new Date('2022-08-05'), warrantyExpiry: daysFromNow(-60),
    purchaseCost: 3400,
    specs: { ram: '8 GB ECC', storage: '8x 8TB WD Red RAID-6', ipAddress: '10.0.1.20' },
    notes: 'Backup NAS. Warranty expired — renewal quote requested from Dell.',
    customFields: {}, createdAt: new Date(), updatedAt: new Date(),
  },
  // Access Points
  {
    _id: assetIds.ap01, assetTag: 'NET-005', name: 'AP-HQ-FLOOR1-01', type: 'access_point', status: 'active',
    manufacturer: 'Cisco', modelName: 'Aironet 2802I', serialNumber: 'AIR-2802I-HQ-01',
    location: 'Head Office', vendorId: vendorIds.cisco,
    purchaseDate: new Date('2023-06-01'), warrantyExpiry: daysFromNow(500),
    purchaseCost: 650,
    network: { ipAddress: '10.0.2.20', vlan: 10 },
    customFields: {}, createdAt: new Date(), updatedAt: new Date(),
  },
  {
    _id: assetIds.ap02, assetTag: 'NET-006', name: 'AP-HQ-FLOOR2-01', type: 'access_point', status: 'active',
    manufacturer: 'Cisco', modelName: 'Aironet 2802I', serialNumber: 'AIR-2802I-HQ-02',
    location: 'Head Office', vendorId: vendorIds.cisco,
    purchaseDate: new Date('2023-06-01'), warrantyExpiry: daysFromNow(500),
    purchaseCost: 650,
    network: { ipAddress: '10.0.2.21', vlan: 10 },
    customFields: {}, createdAt: new Date(), updatedAt: new Date(),
  },
  // Laptops
  {
    _id: assetIds.lap01, assetTag: 'LAP-001', name: "Sarah Kelly's Laptop", type: 'laptop', status: 'active',
    manufacturer: 'Dell', modelName: 'Latitude 5540', serialNumber: 'DLAT5540-SK001',
    location: 'Head Office', vendorId: vendorIds.dell, assignedTo: userIds.tech1,
    purchaseDate: new Date('2023-09-01'), warrantyExpiry: daysFromNow(800),
    purchaseCost: 1450,
    specs: { cpu: 'Intel Core i7-1365U', ram: '32 GB', storage: '512 GB NVMe SSD', os: 'Windows', osVersion: '11 Pro', ipAddress: '10.0.2.101', macAddress: 'AC:1F:6B:22:33:44' },
    customFields: {}, createdAt: new Date(), updatedAt: new Date(),
  },
  {
    _id: assetIds.lap02, assetTag: 'LAP-002', name: "Mark Byrne's Laptop", type: 'laptop', status: 'active',
    manufacturer: 'Dell', modelName: 'Latitude 5540', serialNumber: 'DLAT5540-MB002',
    location: 'Head Office', vendorId: vendorIds.dell, assignedTo: userIds.tech2,
    purchaseDate: new Date('2023-09-01'), warrantyExpiry: daysFromNow(800),
    purchaseCost: 1450,
    specs: { cpu: 'Intel Core i7-1365U', ram: '32 GB', storage: '512 GB NVMe SSD', os: 'Windows', osVersion: '11 Pro', ipAddress: '10.0.2.102', macAddress: 'AC:1F:6B:22:33:55' },
    customFields: {}, createdAt: new Date(), updatedAt: new Date(),
  },
  {
    _id: assetIds.lap03, assetTag: 'LAP-003', name: "Paul Nolan's Laptop", type: 'laptop', status: 'in_repair',
    manufacturer: 'Dell', modelName: 'Latitude 5430', serialNumber: 'DLAT5430-PN003',
    location: 'Head Office', vendorId: vendorIds.dell, assignedTo: userIds.user1,
    purchaseDate: new Date('2022-03-15'), warrantyExpiry: daysFromNow(-30),
    purchaseCost: 1200,
    specs: { cpu: 'Intel Core i5-1245U', ram: '16 GB', storage: '256 GB NVMe SSD', os: 'Windows', osVersion: '11 Pro' },
    notes: 'Sent to Dell repair — broken display hinge. Warranty expired.',
    customFields: {}, createdAt: new Date(), updatedAt: new Date(),
  },
  {
    _id: assetIds.ws01, assetTag: 'WS-001', name: "Emma Quinn's Workstation", type: 'workstation', status: 'active',
    manufacturer: 'Dell', modelName: 'OptiPlex 7010', serialNumber: 'DOPT7010-EQ001',
    location: 'Head Office', vendorId: vendorIds.dell, assignedTo: userIds.user2,
    purchaseDate: new Date('2023-02-20'), warrantyExpiry: daysFromNow(670),
    purchaseCost: 950,
    specs: { cpu: 'Intel Core i7-13700', ram: '32 GB', storage: '512 GB NVMe SSD', os: 'Windows', osVersion: '11 Pro', ipAddress: '10.0.2.110', macAddress: 'AC:1F:6B:33:44:66' },
    customFields: {}, createdAt: new Date(), updatedAt: new Date(),
  },
  {
    _id: assetIds.printer1, assetTag: 'PRT-001', name: 'Printer-HQ-Floor1', type: 'printer', status: 'active',
    manufacturer: 'HP', modelName: 'LaserJet Enterprise M507dn', serialNumber: 'HPLJ-M507-HQ01',
    location: 'Head Office',
    purchaseDate: new Date('2022-06-10'), warrantyExpiry: daysFromNow(60),
    purchaseCost: 750,
    network: { ipAddress: '10.0.2.200' },
    customFields: {}, createdAt: new Date(), updatedAt: new Date(),
  },
]);
console.log('Assets seeded');

// ── Racks ─────────────────────────────────────────────────────────────────────

const rackIds = {
  dc1: new ObjectId(),
  dc2: new ObjectId(),
};

await db.collection('racks').deleteMany({});
await db.collection('rackmounts').deleteMany({});

await db.collection('racks').insertMany([
  { _id: rackIds.dc1, name: 'RACK-DC-01', location: 'Data Centre', totalU: 42, uNumbering: 'top-down', notes: 'Primary rack — networking & compute', createdAt: new Date(), updatedAt: new Date() },
  { _id: rackIds.dc2, name: 'RACK-DC-02', location: 'Data Centre', totalU: 42, uNumbering: 'top-down', notes: 'Secondary rack — storage & backup', createdAt: new Date(), updatedAt: new Date() },
]);

await db.collection('rackmounts').insertMany([
  // RACK-DC-01: Patch panel, firewall, switches, servers
  { _id: new ObjectId(), rack: rackIds.dc1, label: 'Patch Panel A', startU: 1,  endU: 1,  face: 'front', createdAt: new Date(), updatedAt: new Date() },
  { _id: new ObjectId(), rack: rackIds.dc1, label: 'Patch Panel B', startU: 2,  endU: 2,  face: 'front', createdAt: new Date(), updatedAt: new Date() },
  { _id: new ObjectId(), rack: rackIds.dc1, label: 'Cable Mgmt',    startU: 3,  endU: 3,  face: 'both',  createdAt: new Date(), updatedAt: new Date() },
  { _id: new ObjectId(), rack: rackIds.dc1, asset: assetIds.fw01,   startU: 4,  endU: 5,  face: 'front', createdAt: new Date(), updatedAt: new Date() },
  { _id: new ObjectId(), rack: rackIds.dc1, asset: assetIds.sw01,   startU: 6,  endU: 7,  face: 'front', createdAt: new Date(), updatedAt: new Date() },
  { _id: new ObjectId(), rack: rackIds.dc1, label: 'Blank',         startU: 8,  endU: 8,  face: 'front', createdAt: new Date(), updatedAt: new Date() },
  { _id: new ObjectId(), rack: rackIds.dc1, asset: assetIds.srv02,  startU: 9,  endU: 10, face: 'front', createdAt: new Date(), updatedAt: new Date() },
  { _id: new ObjectId(), rack: rackIds.dc1, asset: assetIds.srv03,  startU: 11, endU: 12, face: 'front', createdAt: new Date(), updatedAt: new Date() },
  { _id: new ObjectId(), rack: rackIds.dc1, asset: assetIds.srv01,  startU: 13, endU: 15, face: 'front', createdAt: new Date(), updatedAt: new Date() },
  // RACK-DC-02: NAS + blanks
  { _id: new ObjectId(), rack: rackIds.dc2, label: 'Patch Panel C', startU: 1,  endU: 1,  face: 'front', createdAt: new Date(), updatedAt: new Date() },
  { _id: new ObjectId(), rack: rackIds.dc2, asset: assetIds.nas01,  startU: 2,  endU: 4,  face: 'front', createdAt: new Date(), updatedAt: new Date() },
]);
console.log('Racks seeded');

// ── Networks ──────────────────────────────────────────────────────────────────

const netIds = {
  mgmt:  new ObjectId(),
  staff: new ObjectId(),
  svr:   new ObjectId(),
  guest: new ObjectId(),
  cork:  new ObjectId(),
};

await db.collection('networks').deleteMany({});
await db.collection('networks').insertMany([
  {
    _id: netIds.mgmt, name: 'Management', address: '10.0.0.0/24', vlanId: 1,
    gateway: '10.0.0.1', dnsServers: ['10.0.1.11', '8.8.8.8'],
    dhcpEnabled: false, location: locIds.dc,
    description: 'Out-of-band management network for network devices',
    createdAt: new Date(), updatedAt: new Date(),
  },
  {
    _id: netIds.staff, name: 'Staff LAN', address: '10.0.2.0/24', vlanId: 10,
    gateway: '10.0.2.1', dnsServers: ['10.0.1.11', '10.0.1.12'],
    dhcpEnabled: true, dhcpRange: '10.0.2.50 - 10.0.2.200', location: locIds.hq,
    description: 'End-user devices and workstations — Head Office',
    createdAt: new Date(), updatedAt: new Date(),
  },
  {
    _id: netIds.svr, name: 'Server VLAN', address: '10.0.1.0/24', vlanId: 100,
    gateway: '10.0.1.1', dnsServers: ['10.0.1.11', '10.0.1.12'],
    dhcpEnabled: false, location: locIds.dc,
    description: 'Production server segment — Data Centre',
    createdAt: new Date(), updatedAt: new Date(),
  },
  {
    _id: netIds.guest, name: 'Guest Wi-Fi', address: '10.0.3.0/24', vlanId: 30,
    gateway: '10.0.3.1', dnsServers: ['8.8.8.8', '1.1.1.1'],
    dhcpEnabled: true, dhcpRange: '10.0.3.10 - 10.0.3.250', location: locIds.hq,
    description: 'Isolated guest wireless. No access to internal resources.',
    createdAt: new Date(), updatedAt: new Date(),
  },
  {
    _id: netIds.cork, name: 'Cork Branch LAN', address: '10.1.0.0/24', vlanId: 20,
    gateway: '10.1.0.1', dnsServers: ['10.0.1.11'],
    dhcpEnabled: true, dhcpRange: '10.1.0.50 - 10.1.0.150', location: locIds.branch,
    description: 'Branch office LAN. VPN tunnel to Data Centre.',
    createdAt: new Date(), updatedAt: new Date(),
  },
]);
console.log('Networks seeded');

// ── IPAM Allocations ──────────────────────────────────────────────────────────

await db.collection('ipamaddresses').deleteMany({});
await db.collection('ipamaddresses').insertMany([
  { _id: new ObjectId(), network: netIds.svr, address: '10.0.1.10', hostname: 'SRV-DC-FILE-01', asset: assetIds.srv01, status: 'allocated', notes: 'File server', createdAt: new Date(), updatedAt: new Date() },
  { _id: new ObjectId(), network: netIds.svr, address: '10.0.1.11', hostname: 'SRV-DC-DC-01',   asset: assetIds.srv02, status: 'allocated', notes: 'Primary DC', createdAt: new Date(), updatedAt: new Date() },
  { _id: new ObjectId(), network: netIds.svr, address: '10.0.1.12', hostname: 'SRV-DC-APP-01',  asset: assetIds.srv03, status: 'allocated', notes: 'App server / ITin1', createdAt: new Date(), updatedAt: new Date() },
  { _id: new ObjectId(), network: netIds.svr, address: '10.0.1.20', hostname: 'NAS-DC-01',       asset: assetIds.nas01, status: 'allocated', notes: 'Backup NAS', createdAt: new Date(), updatedAt: new Date() },
  { _id: new ObjectId(), network: netIds.mgmt, address: '10.0.0.1', hostname: 'FW-HQ-01',        asset: assetIds.fw01,  status: 'allocated', notes: 'Firewall mgmt', createdAt: new Date(), updatedAt: new Date() },
  { _id: new ObjectId(), network: netIds.mgmt, address: '10.0.0.2', hostname: 'SW-DC-CORE-01',   asset: assetIds.sw01,  status: 'allocated', notes: 'Core switch mgmt', createdAt: new Date(), updatedAt: new Date() },
  { _id: new ObjectId(), network: netIds.staff, address: '10.0.2.101', hostname: 'LAPTOP-SK',    asset: assetIds.lap01, status: 'allocated', notes: '', createdAt: new Date(), updatedAt: new Date() },
  { _id: new ObjectId(), network: netIds.staff, address: '10.0.2.102', hostname: 'LAPTOP-MB',    asset: assetIds.lap02, status: 'allocated', notes: '', createdAt: new Date(), updatedAt: new Date() },
  { _id: new ObjectId(), network: netIds.staff, address: '10.0.2.110', hostname: 'WS-EQ',        asset: assetIds.ws01,  status: 'allocated', notes: '', createdAt: new Date(), updatedAt: new Date() },
  { _id: new ObjectId(), network: netIds.staff, address: '10.0.2.200', hostname: 'PRINTER-HQ-1', asset: assetIds.printer1, status: 'allocated', createdAt: new Date(), updatedAt: new Date() },
  { _id: new ObjectId(), network: netIds.staff, address: '10.0.2.1',   hostname: 'SW-HQ-ACC-01', asset: assetIds.sw02, status: 'allocated', createdAt: new Date(), updatedAt: new Date() },
]);
console.log('IPAM seeded');

// ── Vault Folders + Credentials ───────────────────────────────────────────────

const folderIds = {
  infra:    new ObjectId(),
  network:  new ObjectId(),
  services: new ObjectId(),
};

await db.collection('vaultfolders').deleteMany({});
await db.collection('credentials').deleteMany({});

await db.collection('vaultfolders').insertMany([
  { _id: folderIds.infra,    name: 'Infrastructure', icon: 'server',    colour: '#6366f1', sortOrder: 0, createdAt: new Date(), updatedAt: new Date() },
  { _id: folderIds.network,  name: 'Network Devices', icon: 'network',  colour: '#0ea5e9', sortOrder: 1, createdAt: new Date(), updatedAt: new Date() },
  { _id: folderIds.services, name: 'Cloud & Services', icon: 'cloud',   colour: '#10b981', sortOrder: 2, createdAt: new Date(), updatedAt: new Date() },
]);

function cred(title, username, password, url, category, folderId, accessLevel = 'admin', asset = null) {
  const enc = encrypt(password);
  return {
    _id: new ObjectId(),
    title, username,
    encryptedPassword: enc.ciphertext,
    encryptionIv: enc.iv,
    encryptionAuthTag: enc.authTag,
    url, category,
    folder: folderId,
    linkedAsset: asset,
    tags: [],
    accessLevel,
    allowedUsers: [],
    createdBy: userIds.admin,
    createdAt: new Date(), updatedAt: new Date(),
  };
}

await db.collection('credentials').insertMany([
  cred('Domain Controller — Local Admin',     'administrator', 'Acm3!DC$2024',    null,                          'device',          folderIds.infra,    'admin', assetIds.srv02),
  cred('File Server — Local Admin',           'administrator', 'F1l3$rver!2024',  null,                          'device',          folderIds.infra,    'admin', assetIds.srv01),
  cred('App Server — Local Admin',            'administrator', 'App$rver!2024',   null,                          'device',          folderIds.infra,    'admin', assetIds.srv03),
  cred('Active Directory Service Account',    'svc-itdesk',    'SvcItD3sk!AD99',  null,                          'service_account', folderIds.infra,    'admin'),
  cred('FortiGate Firewall — Admin',          'admin',         'F0rt1g4t3!HQ',    'https://10.0.0.1',            'device',          folderIds.network,  'admin', assetIds.fw01),
  cred('Cisco Core Switch — Enable Secret',   'admin',         'C1sc0$w!tch01',   'https://10.0.0.2',            'device',          folderIds.network,  'admin', assetIds.sw01),
  cred('NAS Admin',                           'admin',         'Syn0l0gy!NAS',    'https://10.0.1.20:5001',      'device',          folderIds.infra,    'admin', assetIds.nas01),
  cred('Microsoft 365 Global Admin',          'globaladmin@acme.ie', 'M365Gl0b@l!2024', 'https://portal.microsoft.com', 'shared_account', folderIds.services, 'admin'),
  cred('Azure Portal',                        'admin@acme.onmicrosoft.com', 'Az!ureP0rtal24', 'https://portal.azure.com', 'shared_account', folderIds.services, 'admin'),
  cred('Meraki Dashboard',                    'admin@acme.ie', 'M3r4k1!Dash24',  'https://dashboard.meraki.com','shared_account',  folderIds.services, 'admin'),
]);
console.log('Vault seeded');

// ── Tickets ───────────────────────────────────────────────────────────────────

await db.collection('tickets').deleteMany({});
await db.collection('tickets').insertMany([
  {
    _id: new ObjectId(), ticketNumber: 'TKT-0001',
    title: 'Laptop display hinge broken — Paul Nolan',
    description: "Paul's Dell Latitude 5430 display hinge has snapped. Laptop still functional but screen is unstable. Needs repair or replacement.",
    status: 'in_progress', priority: 'medium', source: 'web',
    category: catIds.hardware, submittedBy: userIds.user1, assignedTo: userIds.tech2,
    relatedAssets: [assetIds.lap03], tags: ['dell', 'repair'],
    comments: [
      { _id: new ObjectId(), author: userIds.tech2, body: 'Logged with Dell warranty — ref DEL-IE-2024-88321. Expected turnaround 5 business days.', isInternal: true, createdAt: daysAgo(2) },
    ],
    createdAt: daysAgo(5), updatedAt: daysAgo(2),
  },
  {
    _id: new ObjectId(), ticketNumber: 'TKT-0002',
    title: 'VPN not connecting from Cork office',
    description: 'Several users in the Cork branch cannot connect to the VPN. Error: "IKE negotiation failed". Started this morning around 9am.',
    status: 'resolved', priority: 'high', source: 'web',
    category: catIds.network, submittedBy: userIds.user2, assignedTo: userIds.tech1,
    relatedAssets: [assetIds.sw03], tags: ['vpn', 'cork', 'fortinet'],
    comments: [
      { _id: new ObjectId(), author: userIds.tech1, body: 'Phase 1 IKE proposal mismatch after FortiGate firmware update. Rolled back phase 1 config. VPN restored.', isInternal: false, createdAt: daysAgo(8) },
    ],
    resolvedAt: daysAgo(8), createdAt: daysAgo(10), updatedAt: daysAgo(8),
  },
  {
    _id: new ObjectId(), ticketNumber: 'TKT-0003',
    title: 'New starter setup — Emma Quinn, Operations',
    description: 'New hire starting Monday. Please set up workstation, M365 account, and VPN access.',
    status: 'closed', priority: 'medium', source: 'web',
    category: catIds.access, submittedBy: userIds.admin, assignedTo: userIds.tech2,
    relatedAssets: [assetIds.ws01], tags: ['onboarding'],
    comments: [
      { _id: new ObjectId(), author: userIds.tech2, body: 'M365 account created, workstation imaged and joined to domain, VPN profile deployed.', isInternal: false, createdAt: daysAgo(14) },
    ],
    resolvedAt: daysAgo(14), closedAt: daysAgo(13), createdAt: daysAgo(15), updatedAt: daysAgo(13),
  },
  {
    _id: new ObjectId(), ticketNumber: 'TKT-0004',
    title: 'Printer on Floor 1 offline',
    description: 'HP LaserJet on Floor 1 showing offline in print queue for all users. IP seems unreachable.',
    status: 'open', priority: 'low', source: 'web',
    category: catIds.hardware, submittedBy: userIds.user1, assignedTo: userIds.tech2,
    relatedAssets: [assetIds.printer1], tags: ['printer'],
    comments: [],
    createdAt: daysAgo(1), updatedAt: daysAgo(1),
  },
  {
    _id: new ObjectId(), ticketNumber: 'TKT-0005',
    title: 'Request: Adobe Acrobat Pro licence for Finance team',
    description: 'Finance need Adobe Acrobat Pro for contract signing workflows. Requesting 3 licences.',
    status: 'pending', priority: 'low', source: 'web',
    category: catIds.software, submittedBy: userIds.user1, assignedTo: userIds.tech1,
    relatedAssets: [], tags: ['adobe', 'licence', 'finance'],
    comments: [
      { _id: new ObjectId(), author: userIds.tech1, body: 'Awaiting budget approval from Finance Director before purchasing.', isInternal: true, createdAt: daysAgo(3) },
    ],
    createdAt: daysAgo(4), updatedAt: daysAgo(3),
  },
]);
console.log('Tickets seeded');

// ── Software Licences ─────────────────────────────────────────────────────────

await db.collection('softwarelicenses').deleteMany({});
await db.collection('softwarelicenses').insertMany([
  {
    _id: new ObjectId(), name: 'Microsoft 365 Business Premium', vendor: 'Microsoft',
    type: 'subscription', billingCycle: 'annually', seats: 50, seatsUsed: 43,
    cost: 4800, renewalDate: daysFromNow(182), status: 'active',
    notes: 'EA agreement via Microsoft direct. Includes Intune + Defender.',
    createdAt: new Date(), updatedAt: new Date(),
  },
  {
    _id: new ObjectId(), name: 'Windows Server 2022 Standard', vendor: 'Microsoft',
    type: 'perpetual', billingCycle: 'one_time', seats: 4, seatsUsed: 3,
    cost: 1200, status: 'active',
    notes: 'OEM licences tied to Dell servers.',
    createdAt: new Date(), updatedAt: new Date(),
  },
  {
    _id: new ObjectId(), name: 'FortiGate UTM Subscription', vendor: 'Fortinet',
    type: 'subscription', billingCycle: 'annually', seats: 1, seatsUsed: 1,
    cost: 890, renewalDate: daysFromNow(45), status: 'expiring_soon',
    notes: 'Covers UTP bundle: IPS, AV, web filter, app control.',
    createdAt: new Date(), updatedAt: new Date(),
  },
  {
    _id: new ObjectId(), name: 'Cisco Smart Net — Catalyst 9300', vendor: 'Cisco',
    type: 'subscription', billingCycle: 'annually', seats: 1, seatsUsed: 1,
    cost: 650, renewalDate: daysFromNow(240), status: 'active',
    createdAt: new Date(), updatedAt: new Date(),
  },
]);
console.log('Software licences seeded');

// ── Contracts ─────────────────────────────────────────────────────────────────

await db.collection('contracts').deleteMany({});
await db.collection('contracts').insertMany([
  {
    _id: new ObjectId(), name: 'Eircom Leased Line — 1Gbps', vendorId: vendorIds.eircom,
    type: 'service', status: 'active', value: 18000,
    startDate: new Date('2022-04-01'), endDate: daysFromNow(350),
    noticePeriodDays: 90, notes: 'Primary internet link, Data Centre. SLA 99.9% uptime.',
    createdAt: new Date(), updatedAt: new Date(),
  },
  {
    _id: new ObjectId(), name: 'Dell ProSupport Plus — Server Fleet', vendorId: vendorIds.dell,
    type: 'support', status: 'active', value: 3200,
    startDate: new Date('2023-01-20'), endDate: daysFromNow(280),
    noticePeriodDays: 30, notes: 'Covers SRV-001, SRV-002, SRV-003. NBD onsite response.',
    createdAt: new Date(), updatedAt: new Date(),
  },
  {
    _id: new ObjectId(), name: 'Office Lease — Head Office', vendorId: null,
    type: 'lease', status: 'active', value: 120000,
    startDate: new Date('2021-01-01'), endDate: daysFromNow(620),
    noticePeriodDays: 180, notes: '14 Harbour View. Break clause at year 5.',
    createdAt: new Date(), updatedAt: new Date(),
  },
  {
    _id: new ObjectId(), name: 'Cisco Meraki — MX Licence', vendorId: vendorIds.cisco,
    type: 'service', status: 'expiring_soon', value: 480,
    startDate: new Date('2023-01-01'), endDate: daysFromNow(22),
    noticePeriodDays: 14, notes: 'ENT licence for MX84 at Cork branch.',
    createdAt: new Date(), updatedAt: new Date(),
  },
]);
console.log('Contracts seeded');

// ── IT Change Log ─────────────────────────────────────────────────────────────

await db.collection('changelogs').deleteMany({});
await db.collection('changelogs').insertMany([
  {
    _id: new ObjectId(), title: 'FortiGate firmware upgrade to 7.4.3',
    description: 'Upgraded FW-HQ-01 from 7.4.1 to 7.4.3 during maintenance window. Resolved CVE-2024-21762. Config backed up pre-upgrade. Tested VPN tunnels and SSL inspection post-upgrade — all OK.',
    category: 'security', performedBy: userIds.tech1, performedAt: daysAgo(7),
    relatedAssets: [assetIds.fw01], tags: ['fortinet', 'firmware', 'security'],
    createdAt: daysAgo(7), updatedAt: daysAgo(7),
  },
  {
    _id: new ObjectId(), title: 'Deployed ITin1 v1.0 to SRV-DC-APP-01',
    description: 'Initial production deployment of ITin1 IT management platform. Docker Compose stack, Nginx reverse proxy, HTTPS via Let\'s Encrypt. MongoDB and Redis on same host.',
    category: 'deployment', performedBy: userIds.admin, performedAt: daysAgo(21),
    relatedAssets: [assetIds.srv03], tags: ['itin1', 'deployment'],
    createdAt: daysAgo(21), updatedAt: daysAgo(21),
  },
  {
    _id: new ObjectId(), title: 'Cisco Catalyst 9300 IOS-XE upgrade',
    description: 'Upgraded SW-DC-CORE-01 from IOS-XE 17.9.3 to 17.12.1. Zero downtime upgrade using StackWise. Verified spanning tree and LACP post-upgrade.',
    category: 'maintenance', performedBy: userIds.tech1, performedAt: daysAgo(30),
    relatedAssets: [assetIds.sw01], tags: ['cisco', 'ios-xe'],
    createdAt: daysAgo(30), updatedAt: daysAgo(30),
  },
  {
    _id: new ObjectId(), title: 'AD Group Policy — BitLocker enforcement',
    description: 'Deployed new GPO to enforce BitLocker on all domain-joined laptops. Recovery keys escrowed to AD. Rollout complete across 12 devices.',
    category: 'security', performedBy: userIds.tech1, performedAt: daysAgo(14),
    relatedAssets: [], tags: ['gpo', 'bitlocker', 'endpoint'],
    createdAt: daysAgo(14), updatedAt: daysAgo(14),
  },
]);
console.log('Change log seeded');

// ── Documentation ─────────────────────────────────────────────────────────────

const docFolderIds = {
  network:   new ObjectId(),
  servers:   new ObjectId(),
  onboarding: new ObjectId(),
};

await db.collection('docfolders').deleteMany({}).catch(() => {});
await db.collection('docs').deleteMany({});

await db.collection('docs').insertMany([
  {
    _id: new ObjectId(),
    title: 'Network Overview',
    content: '<h2>Network Overview</h2><p>ACME Ltd operates a structured network across three sites: Head Office (Dublin 2), Data Centre (Clonshaugh), and Cork Branch Office.</p><h3>VLANs</h3><ul><li><strong>VLAN 1 — Management (10.0.0.0/24):</strong> Out-of-band network device management</li><li><strong>VLAN 10 — Staff LAN (10.0.2.0/24):</strong> End-user devices, Head Office</li><li><strong>VLAN 20 — Cork Branch (10.1.0.0/24):</strong> Branch office, VPN tunnel to DC</li><li><strong>VLAN 30 — Guest Wi-Fi (10.0.3.0/24):</strong> Isolated guest access</li><li><strong>VLAN 100 — Server (10.0.1.0/24):</strong> Production servers</li></ul><h3>Internet</h3><p>Primary: Eircom 1Gbps leased line (Data Centre). Backup: Comreg 100Mbps (Head Office).</p>',
    tags: ['network', 'overview', 'vlan'],
    linkedAssets: [assetIds.fw01, assetIds.sw01],
    createdBy: userIds.tech1, updatedBy: userIds.tech1,
    createdAt: daysAgo(20), updatedAt: daysAgo(5),
  },
  {
    _id: new ObjectId(),
    title: 'Server Build Standard',
    content: '<h2>Server Build Standard</h2><p>All production servers follow this build standard. Deviations require change board approval.</p><h3>OS</h3><ul><li>Windows Server 2022 Standard (application/file servers)</li><li>Ubuntu Server 22.04 LTS (Linux workloads)</li></ul><h3>Patching</h3><p>WSUS for Windows, unattended-upgrades for Ubuntu. Patch window: Sunday 02:00–06:00.</p><h3>Monitoring</h3><p>Zabbix agent installed on all servers. Alert thresholds: CPU &gt;85% 5min, RAM &gt;90%, disk &gt;80%.</p><h3>Backup</h3><p>Veeam B&R — daily incrementals to NAS-DC-01, weekly fulls to off-site S3.</p>',
    tags: ['servers', 'build', 'standard'],
    linkedAssets: [assetIds.srv01, assetIds.srv02, assetIds.srv03],
    createdBy: userIds.tech1, updatedBy: userIds.admin,
    createdAt: daysAgo(45), updatedAt: daysAgo(10),
  },
  {
    _id: new ObjectId(),
    title: 'New Starter IT Checklist',
    content: '<h2>New Starter IT Checklist</h2><p>Complete all items before the new starter\'s first day.</p><h3>Before Start Date</h3><ul><li>Create Active Directory account (format: firstname.lastname)</li><li>Assign M365 Business Premium licence</li><li>Add to appropriate AD security groups</li><li>Prepare and image workstation/laptop</li><li>Join device to domain</li><li>Configure VPN profile (FortiClient)</li></ul><h3>Day One</h3><ul><li>Hand over device and credentials</li><li>Walk through VPN and remote access</li><li>Set up MFA on M365 account</li><li>Confirm printer access</li></ul>',
    tags: ['onboarding', 'checklist', 'new-starter'],
    linkedAssets: [],
    createdBy: userIds.admin, updatedBy: userIds.admin,
    createdAt: daysAgo(60), updatedAt: daysAgo(15),
  },
]);
console.log('Docs seeded');

// ── Done ──────────────────────────────────────────────────────────────────────

await client.close();
console.log('\n✓ Seed complete.');
