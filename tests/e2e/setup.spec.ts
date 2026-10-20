import {test,expect} from '@playwright/test';
for(const width of [360,768,1440])test(`unconfigured application explains setup without overflow at ${width}px`,async({page},testInfo)=>{
 const errors:string[]=[];page.on('pageerror',error=>errors.push(error.message));
 await page.setViewportSize({width,height:900});
 await page.goto('/');
 await expect(page.getByRole('heading',{name:'One township. Connected services.'})).toBeVisible();
 await expect(page.getByText(/No sample availability is shown/)).toBeVisible();
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=document.documentElement.clientWidth)).toBe(true);
 expect(errors).toEqual([]);
 await page.screenshot({path:testInfo.outputPath(`setup-${width}.png`),fullPage:true});
});
