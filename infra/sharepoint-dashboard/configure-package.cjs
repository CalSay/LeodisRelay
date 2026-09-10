const fs = require('node:fs');
const path = require('node:path');
const root = path.join(__dirname, 'leodis-operations-dashboard');
const configPath = path.join(root,'config/package-solution.json');
const config = JSON.parse(fs.readFileSync(configPath,'utf8'));
config.solution.skipFeatureDeployment = false;
config.solution.developer.name = 'Leodis Developments';
config.solution.metadata.shortDescription.default = 'Leodis Operations Dashboard';
config.solution.metadata.longDescription.default = 'Approved Leodis dashboard with project shortcuts, report queues, company hubs and searchable resource directory. No API permissions requested.';
fs.writeFileSync(configPath,JSON.stringify(config,null,2)+'\n');
const manifestPath = path.join(root,'src/webparts/operationsDashboard/OperationsDashboardWebPart.manifest.json');
fs.writeFileSync(manifestPath,JSON.stringify({
  '$schema':'https://developer.microsoft.com/json-schemas/spfx/client-side-web-part-manifest.schema.json',
  id:'523b834b-1bb8-43a8-a8f1-4566719d2ec4',alias:'OperationsDashboardWebPart',componentType:'WebPart',version:'*',manifestVersion:2,
  requiresCustomScript:false,supportedHosts:['SharePointWebPart','SharePointFullPage'],supportsFullBleed:true,supportsThemeVariants:false,
  preconfiguredEntries:[{groupId:'5c03119e-3074-46fd-976b-c60198311f70',group:{default:'Advanced'},title:{default:'Leodis Operations Dashboard'},description:{default:'The approved Leodis dashboard with cards, search and company links.'},officeFabricIconFontName:'ViewDashboard',properties:{}}]
},null,2)+'\n');
