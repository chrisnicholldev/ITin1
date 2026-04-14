import { Router, type IRouter, type Request, type Response } from 'express';
import { requireAuth } from '../../middleware/auth.middleware.js';
import type { AuthenticatedRequest } from '../../middleware/auth.middleware.js';
import { Asset } from '../assets/asset.model.js';
import { Ticket } from '../tickets/ticket.model.js';
import { Article } from '../docs/article.model.js';
import { Contact } from '../contacts/contact.model.js';
import { Vendor } from '../vendors/vendor.model.js';

const router: IRouter = Router();
router.use(requireAuth);

const LIMIT = 5;
const ADMIN_ROLES = new Set(['it_admin', 'super_admin']);
const TECH_ROLES  = new Set(['it_technician', 'it_admin', 'super_admin']);

router.get('/', async (req: Request, res: Response) => {
  const { q } = req.query as { q?: string };
  if (!q || q.trim().length < 2) { res.json({ assets: [], tickets: [], docs: [], contacts: [], vendors: [] }); return; }

  const user    = (req as AuthenticatedRequest).user;
  const isAdmin = ADMIN_ROLES.has(user.role);
  const isTech  = TECH_ROLES.has(user.role);
  const regex   = new RegExp(q.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');

  const [assets, tickets, docs, contacts, vendors] = await Promise.all([
    // Assets — technician+ only
    isTech
      ? Asset.find({ $or: [{ name: regex }, { assetTag: regex }, { serialNumber: regex }, { manufacturer: regex }] })
          .select('name assetTag type status').limit(LIMIT).lean()
      : [],

    // Tickets — end users see their own only
    Ticket.find({
      $or: [{ title: regex }, { ticketNumber: regex }],
      ...(!isAdmin && !isTech ? { submittedBy: user.id } : {}),
    }).select('ticketNumber title status priority').limit(LIMIT).lean(),

    // Docs — drafts for admins only
    Article.find({
      $or: [{ title: regex }, { tags: regex }],
      ...(!isAdmin ? { publishedAt: { $ne: null } } : {}),
    }).populate('folder', 'name').select('title slug folder').limit(LIMIT).lean(),

    // Contacts — technician+ only
    isTech
      ? Contact.find({ $or: [{ displayName: regex }, { email: regex }, { company: regex }] })
          .select('displayName email company').limit(LIMIT).lean()
      : [],

    // Vendors — technician+ only
    isTech
      ? Vendor.find({ $or: [{ name: regex }, { website: regex }] })
          .select('name type').limit(LIMIT).lean()
      : [],
  ]);

  res.json({
    assets:   assets.map((a: any) => ({ id: a._id, name: a.name, assetTag: a.assetTag, type: a.type, status: a.status })),
    tickets:  tickets.map((t: any) => ({ id: t._id, ticketNumber: t.ticketNumber, title: t.title, status: t.status, priority: t.priority })),
    docs:     docs.map((d: any) => ({ slug: d.slug, title: d.title, folder: d.folder?.name })),
    contacts: contacts.map((c: any) => ({ id: c._id, displayName: c.displayName, email: c.email, company: c.company })),
    vendors:  vendors.map((v: any) => ({ id: v._id, name: v.name, type: v.type })),
  });
});

export default router;
