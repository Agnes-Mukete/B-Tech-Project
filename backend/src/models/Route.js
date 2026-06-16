const mongoose = require('mongoose');

const stopSchema = new mongoose.Schema({
  name:        { type: String, required: true, trim: true },
  latitude:    { type: Number },
  longitude:   { type: Number },
  order:       { type: Number, required: true },
  arrivalOffset: { type: Number, default: 0 }, // minutes from departure
});

const routeSchema = new mongoose.Schema(
  {
    routeId:   { type: String, required: true, uppercase: true, trim: true },
    name:      { type: String, required: true, trim: true },
    origin:    { type: String, required: true, trim: true },
    destination: { type: String, required: true, trim: true },

    stops: [stopSchema],

    distanceKm:        { type: Number, required: true },
    estimatedDuration: { type: Number, required: true }, // minutes
    baseFare:          { type: Number, required: true },

    isActive: { type: Boolean, default: true },

    // Multi-tenancy scope
    agencyId: { type: mongoose.Schema.Types.ObjectId, ref: 'Agency', required: true },
  },
  { timestamps: true }
);

// Indexes
routeSchema.index({ agencyId: 1, isActive: 1 });
routeSchema.index({ agencyId: 1, origin: 1, destination: 1 });
routeSchema.index({ routeId: 1, agencyId: 1 }, { unique: true });

module.exports = mongoose.model('Route', routeSchema);
