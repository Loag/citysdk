import express from 'express';
import bodyParser from 'body-parser';
import routes from './services/router';

let app = express();

app.use(bodyParser.json());

app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Headers', 'Authorization, Origin, X-Requested-With, Content-Type, Accept');
  next();
});

app.use('/', routes);
app.listen('3000');
