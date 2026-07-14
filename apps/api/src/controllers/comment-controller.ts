import type { Request, Response } from 'express';
import { CommentModel } from '../models/comment.js';
import { TaskModel } from '../models/task.js';
import { ProjectModel } from '../models/project.js';
import { commentSchema } from '../validators/schemas.js';
import { respond } from '../utils/api.js';
import { recordActivity } from '../services/activity-service.js';
import { notify } from '../services/notification-service.js';
const availableProject = (projectId: string, userId: string) =>
  ProjectModel.exists({ _id: projectId, $or: [{ owner: userId }, { members: userId }] });

export const listComments = async (req: Request, res: Response) => {
  const task = await TaskModel.findById(req.params.taskId);
  if (!task || !(await availableProject(task.project.toString(), req.user!.id))) {
    return respond(res, 404, 'Task not found');
  }
  return respond(
    res,
    200,
    'Comments retrieved',
    await CommentModel.find({ task: req.params.taskId })
      .populate('author', 'name email avatarUrl')
      .sort({ createdAt: 1 }),
  );
};
export const createComment = async (req: Request, res: Response) => {
  const task = await TaskModel.findById(req.params.taskId);
  if (!task || !(await availableProject(task.project.toString(), req.user!.id))) {
    return respond(res, 404, 'Task not found');
  }
  const comment = await CommentModel.create({
    ...commentSchema.parse(req.body),
    task: task.id,
    author: req.user!.id,
  });
  await recordActivity(req.user!.id, 'comment.created', {
    project: task.project.toString(),
    task: task.id,
  });
  if (task.assignee && task.assignee.toString() !== req.user!.id)
    await notify(
      task.assignee.toString(),
      'comment',
      `New comment on “${task.title}”`,
      `/tasks/${task.id}`,
    );
  return respond(
    res,
    200,
    'Comment added',
    await comment.populate('author', 'name email avatarUrl'),
  );
};
export const updateComment = async (req: Request, res: Response) => {
  const comment = await CommentModel.findOneAndUpdate(
    { _id: req.params.commentId, author: req.user!.id },
    commentSchema.parse(req.body),
    { new: true },
  );
  if (comment) {
    const task = await TaskModel.findById(comment.task).select('project');
    if (task)
      await recordActivity(req.user!.id, 'comment.updated', {
        project: task.project.toString(),
        task: task.id,
      });
  }
  return comment
    ? respond(res, 200, 'Comment updated', comment)
    : respond(res, 404, 'Comment not found');
};
export const deleteComment = async (req: Request, res: Response) => {
  const comment = await CommentModel.findOneAndDelete({
    _id: req.params.commentId,
    author: req.user!.id,
  });
  if (comment) {
    const task = await TaskModel.findById(comment.task).select('project');
    if (task)
      await recordActivity(req.user!.id, 'comment.deleted', {
        project: task.project.toString(),
        task: task.id,
      });
  }
  return comment ? respond(res, 200, 'Comment deleted') : respond(res, 404, 'Comment not found');
};
