import { BaseClientSideWebPart } from '@microsoft/sp-webpart-base';
import { renderDashboard } from './renderDashboard';

export default class OperationsDashboardWebPart extends BaseClientSideWebPart<Record<string, never>> {
  public render(): void {
    const shadow = this.domElement.shadowRoot || this.domElement.attachShadow({ mode: 'open' });
    renderDashboard(shadow);
  }
  protected onDispose(): void {
    this.domElement.shadowRoot?.replaceChildren();
  }
}
