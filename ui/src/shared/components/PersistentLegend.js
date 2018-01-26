import React, {PropTypes, Component} from 'react'
import _ from 'lodash'
import uuid from 'node-uuid'

const style = {
  position: 'absolute',
  width: 'calc(100% - 32px)',
  bottom: '8px',
  left: '16px',
  height: '30px',
}

const removeMeasurement = (label = '') => {
  const [measurement] = label.match(/^(.*)[.]/g) || ['']
  return label.replace(measurement, '')
}

const persistentLegendItemClassname = (visibilities, i) => {
  if (visibilities.length) {
    return `persistent-legend--item${visibilities[i] ? '' : ' disabled'}`
  }

  // all series are visible to match expected initial state
  return 'persistent-legend--item'
}

class PersistentLegend extends Component {
  constructor(props) {
    super(props)

    this.state = {
      visibilities: [],
    }
  }

  handleClick = i => () => {
    const visibilities = this.props.dygraph.visibility()
    visibilities[i] = !visibilities[i]

    this.props.dygraph.setVisibility(visibilities)
    this.setState({visibilities})
  }

  render() {
    const {dygraph} = this.props
    const {visibilities} = this.state
    const labels = dygraph ? _.drop(dygraph.getLabels()) : []

    /* Add style={{color: seriesColor}} to <div> & <span> below */
    return (
      <div className="persistent-legend" style={style}>
        {_.map(labels, (v, i) =>
          <div
            className={persistentLegendItemClassname(visibilities, i)}
            key={uuid.v4()}
            onClick={this.handleClick(i)}
          >
            <div
              className="persistent-legend--dot"
              style={{backgroundColor: '#00C9FF'}}
            />
            <span style={{color: '#00C9FF'}}>
              {removeMeasurement(v)}
            </span>
          </div>
        )}
      </div>
    )
  }
}

const {shape} = PropTypes

PersistentLegend.propTypes = {sharedLegend: shape({}), dygraph: shape({})}

export default PersistentLegend
