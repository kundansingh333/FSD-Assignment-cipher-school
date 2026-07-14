import type { Request, Response } from 'express';
import { ProjectModel } from '../models/project.js';
import { projectSchema } from '../validators/schemas.js';
import { respond } from '../utils/api.js';
import { recordActivity } from '../services/activity-service.js';
export const listProjects = async (req: Request, res: Response) =>
  respond(
    res,
    200,
    'Projects retrieved',
    await ProjectModel.find({
      $or: [{ owner: req.user!.id }, { members: req.user!.id }],
      archivedAt: null,
    })
      .populate('owner members', 'name email avatarUrl')
      .sort({ updatedAt: -1 }),
  );
export const createProject = async (req: Request, res: Response) => {
  const values = projectSchema.parse(req.body);
  const project = await ProjectModel.create({
    ...values,
    owner: req.user!.id,
    members: [...new Set([req.user!.id, ...(values.members ?? [])])],
  });
  await recordActivity(req.user!.id, 'project.created', { project: project.id });
  return respond(res, 201, 'Project created', project);
};
export const getProject = async (req: Request, res: Response) => {
  const project = await ProjectModel.findOne({
    _id: req.params.projectId,
    $or: [{ owner: req.user!.id }, { members: req.user!.id }],
  }).populate('owner members', 'name email avatarUrl');
  return project
    ? respond(res, 200, 'Project retrieved', project)
    : respond(res, 404, 'Project not found');
};
export const updateProject = async (req: Request, res: Response) => {
  const project = await ProjectModel.findOneAndUpdate(
    { _id: req.params.projectId, owner: req.user!.id },
    projectSchema.partial().parse(req.body),
    { new: true, runValidators: true },
  );
  if (project) await recordActivity(req.user!.id, 'project.updated', { project: project.id });
  return project
    ? respond(res, 200, 'Project updated', project)
    : respond(res, 404, 'Project not found');
};
export const deleteProject = async (req: Request, res: Response) => {
  const project = await ProjectModel.findOneAndDelete({
    _id: req.params.projectId,
    owner: req.user!.id,
  });
  if (project) await recordActivity(req.user!.id, 'project.deleted', { project: project.id });
  return project ? respond(res, 200, 'Project deleted') : respond(res, 404, 'Project not found');
};
export const archiveProject = async (req: Request, res: Response) => {
  const project = await ProjectModel.findOneAndUpdate(
    { _id: req.params.projectId, owner: req.user!.id },
    { archivedAt: new Date() },
    { new: true },
  );
  if (project) await recordActivity(req.user!.id, 'project.archived', { project: project.id });
  return project
    ? respond(res, 200, 'Project archived', project)
    : respond(res, 404, 'Project not found');
};
