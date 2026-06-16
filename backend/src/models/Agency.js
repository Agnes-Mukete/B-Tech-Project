const mongoose = require('mongoose');

const documentSchema = new mongoose.Schema({
  name: { type: String, required: true },
  fileUrl: { type: String, required: true },
  uploadedAt: { type: Date, default: Date.now },
  verified: { type: Boolean, default: false },
});

const agencySchema = new mongoose.Schema(
  {
    name:        { type: String, required: true, trim: true },
    shortCode:   { type: String, required: true, uppercase: true, trim: true, maxlength: 4 },
    logoColor:   { type: String, default: '#1565C0' },

    ownerName:   { type: String, required: true, trim: true },
    ownerEmail:  { type: String, required: true, lowercase: true, trim: true },
    ownerPhone:  { type: String, required: true, trim: true },

    city:          { type: String, required: true, trim: true },
    coverageCities: [{ type: String, trim: true }],
    amenities:   [{ type: String, enum: ['ac', 'wifi', 'usb', 'toilet', 'tv'] }],
    tier:        { type: String, enum: ['standard', 'premium'], default: 'standard' },

    status:  { type: String, enum: ['pending', 'active', 'suspended'], default: 'pending' },
    visible: { type: Boolean, default: false },

    rating:      { type: Number, default: 0, min: 0, max: 5 },
    ratingCount: { type: Number, default: 0 },
    monthlyTrips: { type: Number, default: 0 },

    documents: [documentSchema],

    // v2.0 multi-tenancy key — also serves as organisationId
    agencyId: { type: mongoose.Schema.Types.ObjectId, ref: 'Agency' },
  },
  { timestamps: true }
);

// Indexes
agencySchema.index({ status: 1, visible: 1 });
agencySchema.index({ ownerEmail: 1 }, { unique: true });
agencySchema.index({ name: 'text', city: 'text', ownerName: 'text' });

// Virtual: self-referencing convenience
agencySchema.virtual('id').get(function () { return this._id; });

module.exports = mongoose.model('Agency', agencySchema);
