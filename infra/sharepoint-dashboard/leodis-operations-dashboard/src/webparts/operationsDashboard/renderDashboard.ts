import { dashboardCss, dashboardHtml, site, paths, groups } from './dashboardContent';

/** Shadow DOM keeps the approved design independent of the host site's theme. */
export function renderDashboard(root: ShadowRoot): void {
  root.innerHTML = `<style>${dashboardCss}</style>${dashboardHtml}`;
  const find = <T extends Element>(selector: string): T => {
    const element = root.querySelector<T>(selector);
    if (!element) throw new Error(`Missing dashboard element: ${selector}`);
    return element;
  };
  const makeLink = (label: string, key: string, className = 'resource'): HTMLAnchorElement => {
    const anchor = document.createElement('a');
    anchor.className = className;
    anchor.href = site + paths[key];
    anchor.target = '_blank';
    anchor.rel = 'noopener noreferrer';
    const title = document.createElement('span');
    title.textContent = label;
    const arrow = document.createElement('span');
    arrow.textContent = '↗';
    arrow.setAttribute('aria-hidden', 'true');
    anchor.append(title, arrow);
    return anchor;
  };
  groups.forEach(group => {
    const section = document.createElement('section');
    section.className = 'group';
    section.dataset.category = group.cat;
    const hint = document.createElement('div');
    hint.className = 'eyebrow';
    hint.textContent = group.hint;
    const title = document.createElement('h3');
    title.textContent = group.title;
    section.append(hint, title);
    group.links.forEach(([label, key]) => section.append(makeLink(label, key)));
    find('#resources').append(section);
  });
  [['Form Templates','forms'],['Site Assets','assets'],['Style Library','style'],
    ['XX - STANDARD DOCUMENTS','xx'],['Site Pages','pages'],['Full site contents','contents']]
    .forEach(([label, key]) => find('#adminlinks').append(makeLink(label, key, '')));
  root.querySelectorAll<HTMLAnchorElement>('[data-key]').forEach(anchor => {
    anchor.href = site + paths[anchor.dataset.key || ''];
    anchor.target = '_blank';
    anchor.rel = 'noopener noreferrer';
  });
  root.querySelectorAll<HTMLAnchorElement>('a[href^="#"]').forEach(anchor => {
    anchor.addEventListener('click', event => {
      const href = anchor.getAttribute('href');
      const target = root.querySelector(!href || href === '#' ? '.leodisDashboard' : href);
      if (target) { event.preventDefault(); target.scrollIntoView({ behavior: 'smooth', block: 'start' }); }
    });
  });
  let category = 'all';
  const filter = (): void => {
    const query = find<HTMLInputElement>('#search').value.toLowerCase().trim();
    let count = 0;
    root.querySelectorAll<HTMLElement>('.group').forEach(group => {
      let matches = 0;
      const heading = group.querySelector('h3')?.textContent?.toLowerCase() || '';
      group.querySelectorAll<HTMLAnchorElement>('.resource').forEach(anchor => {
        anchor.hidden = !!query && !(anchor.textContent || '').toLowerCase().includes(query) && !heading.includes(query);
        if (!anchor.hidden) matches++;
      });
      group.hidden = !matches || (category !== 'all' && group.dataset.category !== category);
      if (!group.hidden) count++;
    });
    find<HTMLElement>('#empty').hidden = count > 0;
  };
  find('#search').addEventListener('input', filter);
  find('#empty').setAttribute('role', 'status');
  root.querySelectorAll<HTMLButtonElement>('[data-filter]').forEach(button => {
    button.addEventListener('click', () => {
      category = button.dataset.filter || 'all';
      root.querySelectorAll('[data-filter]').forEach(item => item.setAttribute('aria-pressed', String(item === button)));
      filter();
    });
  });
}
