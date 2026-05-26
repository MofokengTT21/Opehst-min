import { database } from './index';
import Item from './models/Item';
import Group from './models/Group';
import Subscription from './models/Subscription';
import Log from './models/Log';
import Comment from './models/Comment';

export const seedDatabase = async () => {
  const itemsCount = await database.collections.get('items').query().fetchCount();
  
  if (itemsCount > 0) {
    console.log('Database already seeded');
    return;
  }

  console.log('Seeding WatermelonDB with initial mock data...');

  await database.write(async () => {
    const item1 = await database.collections.get<Item>('items').create(item => {
      item._raw.id = '1';
      item.name = 'Arc 4';
      item.category = 'asset';
      item.description = 'Main furnace Arc 4';
      item.status = 'warning';
      item.accessType = 'open';
    });

    const item2 = await database.collections.get<Item>('items').create(item => {
      item._raw.id = '2';
      item.name = 'Level 3 Shaft';
      item.category = 'location';
      item.description = 'Underground Level 3';
      item.status = 'running';
      item.accessType = 'approval_required';
    });

    const group1 = await database.collections.get<Group>('groups').create(group => {
      group._raw.id = '3';
      group.name = 'Heavy Lifting Ops';
      group.description = 'Coordination for all crane and lifting operations';
      group.accessType = 'open';
    });

    await database.collections.get<Subscription>('subscriptions').create(sub => {
      sub.userId = 'me';
      sub.targetId = item1.id;
      sub.targetType = 'item';
      sub.status = 'approved';
    });

    await database.collections.get<Subscription>('subscriptions').create(sub => {
      sub.userId = 'me';
      sub.targetId = item2.id;
      sub.targetType = 'item';
      sub.status = 'approved';
    });

    await database.collections.get<Subscription>('subscriptions').create(sub => {
      sub.userId = 'me';
      sub.targetId = group1.id;
      sub.targetType = 'group';
      sub.status = 'approved';
    });

    const log1 = await database.collections.get<Log>('logs').create(log => {
      log._raw.id = 'm1';
      log.targetId = item1.id;
      log.targetType = 'item';
      log.authorId = 'system';
      log.authorName = 'System Alert';
      log.subject = 'Critical Temperature Exceeded';
      log.content = 'Arc 4 is running at 92°C. Threshold is 85°C.';
      log.tag = '⚠️ Hazard';
      log.isScadaAlert = true;
    });

    const log2 = await database.collections.get<Log>('logs').create(log => {
      log._raw.id = 'm2';
      log.targetId = item1.id;
      log.targetType = 'item';
      log.authorId = 'user-2';
      log.authorName = 'John (Fitter)';
      log.subject = 'Oil Leak on Main Drive Gearbox';
      log.content = 'Found a minor seal leak on the left bearing. Needs to be added to the next planned maintenance schedule.';
      log.tag = '✅ 5S Check';
      log.isScadaAlert = false;
    });

    await database.collections.get<Comment>('comments').create(comment => {
      comment.logId = log1.id;
      comment.authorName = 'Tshepo M.';
      comment.content = "I'm heading down to check the cooling lines now.";
    });
  });

  console.log('Seeding complete.');
};
