const Notification = require('../models/Notification');
const { success, paginate } = require('../utils/response');

// GET /api/notifications
exports.list = async (req, res, next) => {
  try {
    const { read, page = 1, limit = 30 } = req.query;
    const filter = { userId: req.user._id };
    if (read === 'true')  filter.read = true;
    if (read === 'false') filter.read = false;

    const skip = (page - 1) * limit;
    const [notifications, total, unreadCount] = await Promise.all([
      Notification.find(filter).sort({ createdAt: -1 }).skip(skip).limit(Number(limit)),
      Notification.countDocuments(filter),
      Notification.countDocuments({ userId: req.user._id, read: false }),
    ]);

    return res.json({
      success: true,
      data: notifications,
      unreadCount,
      pagination: { page: Number(page), limit: Number(limit), total, pages: Math.ceil(total / limit) },
    });
  } catch (err) { next(err); }
};

// PATCH /api/notifications/:id/read
exports.markRead = async (req, res, next) => {
  try {
    await Notification.updateOne(
      { _id: req.params.id, userId: req.user._id },
      { $set: { read: true, readAt: new Date() } }
    );
    return success(res, {}, 'Marked as read');
  } catch (err) { next(err); }
};

// PATCH /api/notifications/read-all
exports.markAllRead = async (req, res, next) => {
  try {
    await Notification.updateMany(
      { userId: req.user._id, read: false },
      { $set: { read: true, readAt: new Date() } }
    );
    return success(res, {}, 'All notifications marked as read');
  } catch (err) { next(err); }
};

// DELETE /api/notifications/:id
exports.remove = async (req, res, next) => {
  try {
    await Notification.deleteOne({ _id: req.params.id, userId: req.user._id });
    return success(res, {}, 'Notification deleted');
  } catch (err) { next(err); }
};

// GET /api/notifications/unread-count
exports.unreadCount = async (req, res, next) => {
  try {
    const count = await Notification.countDocuments({ userId: req.user._id, read: false });
    return success(res, { count });
  } catch (err) { next(err); }
};
