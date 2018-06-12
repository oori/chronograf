import _ from 'lodash'
import classnames from 'classnames'
import React, {Component, MouseEvent} from 'react'
import {Grid, AutoSizer, InfiniteLoader} from 'react-virtualized'
import FancyScrollbar from 'src/shared/components/FancyScrollbar'
import {getDeep} from 'src/utils/wrappers'

import {
  getColumnFromData,
  getValueFromData,
  getValuesFromData,
  isClickable,
  formatColumnValue,
  header,
  getColumnWidth,
  getMessageWidth,
  getColumnsFromData,
} from 'src/logs/utils/table'

const ROW_HEIGHT = 26
const CHAR_WIDTH = 9
interface Props {
  data: {
    columns: string[]
    values: string[]
  }
  isScrolledToTop: boolean
  onScrollVertical: () => void
  onScrolledToTop: () => void
  onTagSelection: (selection: {tag: string; key: string}) => void
  fetchMore: (time: number) => Promise<void>
  count: number
}

interface State {
  scrollLeft: number
  scrollTop: number
  currentRow: number
  currentMessageWidth: number
  lastQueryTime: number
}

class LogsTable extends Component<Props, State> {
  public static getDerivedStateFromProps(props, state): State {
    const {isScrolledToTop} = props

    let lastQueryTime = _.get(state, 'lastQueryTime', null)
    let scrollTop = _.get(state, 'scrollTop', 0)
    if (isScrolledToTop) {
      lastQueryTime = null
      scrollTop = 0
    }

    const scrollLeft = _.get(state, 'scrollLeft', 0)

    return {
      ...state,
      isQuerying: false,
      lastQueryTime,
      scrollTop,
      scrollLeft,
      currentRow: -1,
      currentMessageWidth: getMessageWidth(props.data),
    }
  }

  private grid: Grid | null
  private headerGrid: React.RefObject<Grid>

  constructor(props: Props) {
    super(props)

    this.grid = null
    this.headerGrid = React.createRef()

    this.state = {
      scrollTop: 0,
      scrollLeft: 0,
      currentRow: -1,
      currentMessageWidth: 0,
      lastQueryTime: null,
    }
  }

  public componentDidUpdate() {
    if (this.grid) {
      this.grid.recomputeGridSize()
    }
    this.headerGrid.current.recomputeGridSize()
  }

  public componentDidMount() {
    window.addEventListener('resize', this.handleWindowResize)
    if (this.grid) {
      this.grid.recomputeGridSize()
    }
    this.headerGrid.current.recomputeGridSize()
  }

  public componentWillUnmount() {
    window.removeEventListener('resize', this.handleWindowResize)
  }

  public render() {
    const columnCount = Math.max(
      getColumnsFromData(this.props.data).length - 1,
      0
    )

    return (
      <div
        className="logs-viewer--table-container"
        onMouseOut={this.handleMouseOut}
      >
        <AutoSizer>
          {({width}) => (
            <Grid
              ref={this.headerGrid}
              height={ROW_HEIGHT}
              rowHeight={ROW_HEIGHT}
              rowCount={1}
              width={width}
              scrollLeft={this.state.scrollLeft}
              onScroll={this.handleHeaderScroll}
              cellRenderer={this.headerRenderer}
              columnCount={columnCount}
              columnWidth={this.getColumnWidth}
            />
          )}
        </AutoSizer>
        <InfiniteLoader
          isRowLoaded={this.isRowLoaded}
          loadMoreRows={this.loadMoreRows}
          rowCount={this.props.count}
        >
          {({registerChild, onRowsRendered}) => (
            <AutoSizer>
              {({width, height}) => (
                <FancyScrollbar
                  style={{
                    width,
                    height,
                    marginTop: `${ROW_HEIGHT}px`,
                  }}
                  setScrollTop={this.handleScrollbarScroll}
                  scrollTop={this.state.scrollTop}
                  autoHide={false}
                >
                  <Grid
                    height={height}
                    rowHeight={this.calculateRowHeight}
                    rowCount={getValuesFromData(this.props.data).length}
                    width={width}
                    scrollLeft={this.state.scrollLeft}
                    scrollTop={this.state.scrollTop}
                    onScroll={this.handleScroll}
                    cellRenderer={this.cellRenderer}
                    onSectionRendered={this.handleRowRender(onRowsRendered)}
                    columnCount={columnCount}
                    columnWidth={this.getColumnWidth}
                    ref={(ref: Grid) => {
                      registerChild(ref)
                      this.grid = ref
                    }}
                    style={{height: this.calculateTotalHeight()}}
                  />
                </FancyScrollbar>
              )}
            </AutoSizer>
          )}
        </InfiniteLoader>
      </div>
    )
  }

  private handleRowRender = onRowsRendered => ({
    rowStartIndex,
    rowStopIndex,
  }) => {
    onRowsRendered({startIndex: rowStartIndex, stopIndex: rowStopIndex})
  }

  private loadMoreRows = async () => {
    const data = getValuesFromData(this.props.data)
    const lastTime = getDeep(
      data,
      `${data.length - 1}.0`,
      new Date().getTime() / 1000
    )

    if (this.state.lastQueryTime && this.state.lastQueryTime <= lastTime) {
      return
    }

    await this.setState({lastQueryTime: lastTime})
    await this.props.fetchMore(lastTime)
  }

  private isRowLoaded = ({index}) => {
    return !!getValuesFromData(this.props.data)[index]
  }

  private handleWindowResize = () => {
    this.setState({currentMessageWidth: getMessageWidth(this.props.data)})
  }

  private handleHeaderScroll = ({scrollLeft}): void =>
    this.setState({scrollLeft})

  private handleScrollbarScroll = (e: MouseEvent<JSX.Element>): void => {
    const {target} = e
    this.handleScroll(target)
  }

  private getColumnWidth = ({index}: {index: number}): number => {
    const column = getColumnFromData(this.props.data, index + 1)
    const {currentMessageWidth} = this.state

    switch (column) {
      case 'message':
        return currentMessageWidth
      default:
        return getColumnWidth(column)
    }
  }

  private get rowCharLimit(): number {
    const {currentMessageWidth} = this.state
    return Math.floor(currentMessageWidth / CHAR_WIDTH)
  }

  private calculateTotalHeight = (): number => {
    const data = getValuesFromData(this.props.data)
    return _.reduce(
      data,
      (acc, __, index) => {
        return acc + this.calculateMessageHeight(index)
      },
      0
    )
  }

  private calculateMessageHeight = (index: number): number => {
    const columns = getColumnsFromData(this.props.data)
    const columnIndex = columns.indexOf('message')
    const value = getValueFromData(this.props.data, index, columnIndex)
    const lines = Math.round(value.length / this.rowCharLimit + 0.25)

    return Math.max(lines, 1) * (ROW_HEIGHT - 14) + 14
  }

  private calculateRowHeight = ({index}: {index: number}): number => {
    return this.calculateMessageHeight(index)
  }

  private handleScroll = scrollInfo => {
    const {scrollLeft, scrollTop} = scrollInfo

    if (scrollTop === 0) {
      this.props.onScrolledToTop()
    } else if (scrollTop !== this.state.scrollTop) {
      this.props.onScrollVertical()
    }

    this.setState({scrollLeft, scrollTop})
  }

  private headerRenderer = ({key, style, columnIndex}) => {
    const column = getColumnFromData(this.props.data, columnIndex + 1)
    const classes = 'logs-viewer--cell logs-viewer--cell-header'

    return (
      <div className={classes} style={style} key={key}>
        {header(column)}
      </div>
    )
  }

  private cellRenderer = ({key, style, rowIndex, columnIndex}) => {
    const column = getColumnFromData(this.props.data, columnIndex + 1)
    const value = getValueFromData(this.props.data, rowIndex, columnIndex + 1)

    let formattedValue: string | JSX.Element
    if (column === 'severity') {
      formattedValue = (
        <div
          className={`logs-viewer--dot ${value}-severity`}
          title={value}
          onMouseOver={this.handleMouseEnter}
          data-index={rowIndex}
        />
      )
    } else {
      formattedValue = formatColumnValue(column, value, this.rowCharLimit)
    }

    const highlightRow = rowIndex === this.state.currentRow

    if (isClickable(column)) {
      return (
        <div
          className={classnames('logs-viewer--cell', {
            highlight: highlightRow,
          })}
          title={`Filter by "${formattedValue}"`}
          style={{...style, padding: '5px'}}
          key={key}
          data-index={rowIndex}
          onMouseOver={this.handleMouseEnter}
        >
          <div
            data-tag-key={column}
            data-tag-value={value}
            onClick={this.handleTagClick}
            data-index={rowIndex}
            onMouseOver={this.handleMouseEnter}
            className="logs-viewer--clickable"
          >
            {formattedValue}
          </div>
        </div>
      )
    }

    return (
      <div
        className={classnames(`logs-viewer--cell  ${column}--cell`, {
          highlight: highlightRow,
        })}
        key={key}
        style={style}
        onMouseOver={this.handleMouseEnter}
        data-index={rowIndex}
      >
        {formattedValue}
      </div>
    )
  }

  private handleMouseEnter = (e: MouseEvent<HTMLElement>): void => {
    const target = e.target as HTMLElement
    this.setState({currentRow: +target.dataset.index})
  }

  private handleTagClick = (e: MouseEvent<HTMLElement>) => {
    const {onTagSelection} = this.props
    const target = e.target as HTMLElement
    const selection = {
      tag: target.dataset.tagValue,
      key: target.dataset.tagKey,
    }

    onTagSelection(selection)
  }

  private handleMouseOut = () => {
    this.setState({currentRow: -1})
  }
}

export default LogsTable
