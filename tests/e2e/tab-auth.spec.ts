import {test,expect} from '@playwright/test';
import {contractFixture,id} from './contract-fixture';

test('different demo roles can remain signed in independently in two browser tabs',async({page,context})=>{
 const resident=await contractFixture(page,'resident',{user:id(10),email:'resident-tab@example.test'});
 const managerPage=await context.newPage();
 const manager=await contractFixture(managerPage,'manager',{user:id(11),email:'manager-tab@example.test'});

 await resident.login();
 await expect(page.getByRole('button',{name:'Open account'})).toHaveText('R');
 await expect(page.getByRole('button',{name:'Sign out'})).toBeVisible();

 await manager.login();
 await expect(managerPage.getByRole('button',{name:'Open account'})).toHaveText('M');
 await expect(managerPage.getByRole('button',{name:'Sign out'})).toBeVisible();

 // A sign-in in one tab must never update the other tab's authenticated identity.
 await expect(page.getByRole('button',{name:'Open account'})).toHaveText('R');
 await expect(page.getByRole('button',{name:'Sign out'})).toBeVisible();

 const residentStorage=await page.evaluate(()=>({
  id:Object.keys(sessionStorage).filter(key=>key.includes('tab-id.v1.')).map(key=>sessionStorage.getItem(key))[0],
  tokens:Object.keys(sessionStorage).filter(key=>key.startsWith('smarttownship-tab-auth-')),
  globalTokens:Object.keys(localStorage).filter(key=>/^sb-.*-auth-token$/.test(key)),
 }));
 const managerStorage=await managerPage.evaluate(()=>({
  id:Object.keys(sessionStorage).filter(key=>key.includes('tab-id.v1.')).map(key=>sessionStorage.getItem(key))[0],
  tokens:Object.keys(sessionStorage).filter(key=>key.startsWith('smarttownship-tab-auth-')),
  globalTokens:Object.keys(localStorage).filter(key=>/^sb-.*-auth-token$/.test(key)),
 }));
 expect(residentStorage.id).toBeTruthy();
 expect(managerStorage.id).toBeTruthy();
 expect(residentStorage.id).not.toBe(managerStorage.id);
 expect(residentStorage.tokens).toHaveLength(1);
 expect(managerStorage.tokens).toHaveLength(1);
 expect(residentStorage.tokens[0]).not.toBe(managerStorage.tokens[0]);
 expect(residentStorage.globalTokens).toEqual([]);
 expect(managerStorage.globalTokens).toEqual([]);

 // Ordinary refresh preserves this tab's own session and role.
 await page.reload();
 await managerPage.reload();
 await expect(page.getByRole('button',{name:'Open account'})).toHaveText('R');
 await expect(managerPage.getByRole('button',{name:'Open account'})).toHaveText('M');

 // Logging out manager must not sign resident out.
 await managerPage.getByRole('button',{name:'Sign out'}).click();
 await expect(managerPage.getByRole('button',{name:'Sign in'})).toBeVisible();
 await expect(page.getByRole('button',{name:'Sign out'})).toBeVisible();
 await expect(page.getByRole('button',{name:'Open account'})).toHaveText('R');
 await page.reload();
 await expect(page.getByRole('button',{name:'Open account'})).toHaveText('R');
});
