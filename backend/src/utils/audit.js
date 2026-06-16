const AuditLog = require('../models/AuditLog');

const recordAudit = async (req, { action, entityType, entityId, agencyId = null, metadata = {} }) => {
  try {
    await AuditLog.create({
      actorId: req.user?._id || req.user?.id || null,
      actorRole: req.user?.role,
      action,
      entityType,
      entityId,
      agencyId,
      metadata,
    });
  } catch (_) {
    // Audit logging must not break the main user workflow.
  }
};

module.exports = { recordAudit };
