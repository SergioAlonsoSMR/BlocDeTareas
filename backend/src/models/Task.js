'use strict';

const mongoose = require('mongoose');

const taskSchema = new mongoose.Schema({
  title: { type: String, required: true, trim: true, maxlength: 80 },
  description: { type: String, default: '', maxlength: 500 },
  status: { type: String, enum: ['pendiente', 'en_progreso', 'completado'], default: 'pendiente', required: true },
  owner: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
}, { timestamps: true, versionKey: false });

taskSchema.index({ owner: 1, status: 1, createdAt: -1 });

module.exports = mongoose.models.Task || mongoose.model('Task', taskSchema);
