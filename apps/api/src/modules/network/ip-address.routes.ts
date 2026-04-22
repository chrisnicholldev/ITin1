import { Router, type IRouter } from 'express';
import type { Request, Response } from 'express';
import { requireAuth, requireTech, requireAdmin } from '../../middleware/auth.middleware.js';
import * as service from './ip-address.service.js';

const router: IRouter = Router();

router.use(requireAuth, requireTech);

// GET /ipam/:networkId — full subnet view with grid + assignments
router.get('/:networkId', async (req: Request, res: Response): Promise<void> => {
  res.json(await service.getIpamForNetwork(String(req.params['networkId'])));
});

// POST /ipam/:networkId — assign an IP
router.post('/:networkId', requireAdmin, async (req: Request, res: Response): Promise<void> => {
  const { address, label, type, assetId, notes, monitored } = req.body as {
    address: string; label: string; type?: 'static' | 'reserved' | 'dhcp'; assetId?: string; notes?: string; monitored?: boolean;
  };
  if (!address || !label) { res.status(400).json({ error: 'address and label are required' }); return; }
  res.status(201).json(await service.assignIp(String(req.params['networkId']), { address, label, type, assetId, notes, monitored }));
});

// PATCH /ipam/:networkId/:id — update assignment
router.patch('/:networkId/:id', requireAdmin, async (req: Request, res: Response): Promise<void> => {
  res.json(await service.updateIpAssignment(String(req.params['id']), req.body));
});

// DELETE /ipam/:networkId/:id — release IP
router.delete('/:networkId/:id', requireAdmin, async (req: Request, res: Response): Promise<void> => {
  await service.releaseIp(String(req.params['id']));
  res.status(204).send();
});

// POST /ipam/:networkId/scan — probe subnet for live hosts
router.post('/:networkId/scan', requireAdmin, async (req: Request, res: Response): Promise<void> => {
  res.json(await service.scanSubnet(String(req.params['networkId'])));
});

export default router;
