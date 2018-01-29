var Aws = require('aws-sdk')
var _ = require('lodash')
module.exports = function (options) {
  var seneca = this
  options = seneca.util.deepextend({
    region: 'eu-west-1'
  }, options)
  var plugin = 'aws'
  seneca.add({
    role: plugin,
    service: {
      type$: 'string',
      required$: true
    },
    command: {
      type$: 'string',
      required$: true
    },
    region: {
      type$: 'string'
    }
  }, aws)

  function aws (msg, done) {
    var opt = _.clone(options)
    if (msg.region) opt.region = msg.region
    Aws.config.update(opt)
    var service = new Aws[msg.service]()
    var params = seneca.util.clean(msg)
    delete params.role
    delete params.service
    delete params.command
    delete params.region
    delete params.in
    service[msg.command](params, done)
  }
  seneca.add({
    role: plugin,
    cmd: 'cheapest-zone',
    instance_type: {
      type$: 'string',
      required$: true
    }
  }, cheapest_zone)

  function cheapest_zone (msg, done) {
    seneca.act({
      flow: {
        $with: {
          role: plugin,
          service: 'EC2',
          command: 'describeAvailabilityZones',
          out$: {
            _: 'get',
            args: 'AvailabilityZones'
          }
        },
        iterate: {
          role: plugin,
          $AvailabilityZone: '$.in.ZoneName',
          InstanceTypes: [msg.instance_type],
          service: 'EC2',
          command: 'describeSpotPriceHistory',
          ProductDescriptions: ['Linux/UNIX'],
          MaxResults: 1,
          out$: {
            _: 'get',
            args: 'SpotPriceHistory[0]'
          }
        }
      },
      parent$: msg.meta$.id
    }, function (err, res) {
      var type = _.minBy(res, function (o) {
        return _.toNumber(o.SpotPrice)
      })
      done(err, {
        zone: type.AvailabilityZone.substring(type.AvailabilityZone.length - 1),
        'spot-price': _.toNumber(type.SpotPrice)
      })
    })
  }
  return plugin
}
