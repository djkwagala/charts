import { Component, ReactChild, createElement } from "react";
import { MapDispatchToProps, MapStateToProps, connect } from "react-redux";
import { bindActionCreators } from "redux";

import AnyChart, { AnyChartProps } from "./AnyChart";
import { AnyChartPlayground } from "./AnyPlayground";
import { isContextChanged, renderError, validateAdvancedOptions } from "../../utils/data";

import { Container } from "../../utils/namespaces";
import * as AnyChartActions from "../store/AnyChartActions";
import * as PlotlyChartActions from "../../components/actions/PlotlyChartActions";
import AnyChartContainerProps = Container.AnyChartContainerProps;
import { AnyChartInstanceState, defaultInstanceState } from "../store/AnyChartReducer";
import { ReduxStore, store } from "../store";

export type Actions = typeof AnyChartActions & typeof PlotlyChartActions;
export type AnyChartDataHandlerProps = AnyChartContainerProps & AnyChartInstanceState & Actions;

export class AnyChartDataHandler extends Component<AnyChartDataHandlerProps> {
    private subscriptionHandles: number[] = [];

    render() {
        const anyProps: AnyChartProps = {
            ...this.props as AnyChartDataHandlerProps,
            onClick: this.onClick,
            onHover: this.props.tooltipForm ? this.onHover : undefined
        };

        return createElement("div", { className: "widget-charts-wrapper" },
            createElement(this.props.devMode === "developer" ? AnyChartPlayground : AnyChart, anyProps)
        );
    }

    componentDidMount() {
        const validationError = AnyChartDataHandler.validateSeriesProps(this.props);
        if (validationError) {
            this.props.showAlertMessage(this.props.friendlyId, validationError);
        }
    }

    componentWillReceiveProps(nextProps: AnyChartDataHandlerProps) {
        this.resetSubscriptions(nextProps.mxObject);
        if (!nextProps.alertMessage) {
            if (!nextProps.mxObject) {
                nextProps.noContext(nextProps.friendlyId);
            } else if (isContextChanged(this.props.mxObject, nextProps.mxObject)) {
                nextProps.togglePlotlyDataLoading(nextProps.friendlyId, true);
                nextProps.fetchAnyChartData(nextProps);
            }
        }
    }

    shouldComponentUpdate(nextProps: AnyChartDataHandlerProps) {
        const contextChanged = isContextChanged(this.props.mxObject, nextProps.mxObject);
        const advancedOptionsUpdated = nextProps.attributeData !== this.props.attributeData
            || nextProps.attributeLayout !== this.props.attributeLayout
            || nextProps.configurationOptions !== this.props.configurationOptions;
        const playgroundLoaded = !!nextProps.playground && !this.props.playground;

        return contextChanged || advancedOptionsUpdated || playgroundLoaded;
    }

    private resetSubscriptions(mxObject?: mendix.lib.MxObject) {
        this.subscriptionHandles.forEach(window.mx.data.unsubscribe);
        this.subscriptionHandles = [];
        if (mxObject) {
            this.subscriptionHandles.push(window.mx.data.subscribe({
                callback: () => store.dispatch(this.props.fetchAnyChartData(this.props)),
                guid: mxObject.getGuid()
            }));
            if (this.props.dataAttribute) {
                this.subscriptionHandles.push(window.mx.data.subscribe({
                    callback: () => store.dispatch(this.props.fetchAnyChartData(this.props)),
                    guid: mxObject.getGuid(),
                    attr: this.props.dataAttribute
                }));
            }
            if (this.props.layoutAttribute) {
                this.subscriptionHandles.push(window.mx.data.subscribe({
                    callback: () => store.dispatch(this.props.fetchAnyChartData(this.props)),
                    guid: mxObject.getGuid(),
                    attr: this.props.layoutAttribute
                }));
            }
        }
    }

    private onClick(data: any) {
        const { eventEntity, eventDataAttribute, onClickMicroflow, onClickNanoflow, mxform } = this.props;

        if (eventEntity && eventDataAttribute && onClickMicroflow) {
            mx.data.create({
                entity: eventEntity,
                callback: object => {
                    object.set(eventDataAttribute, JSON.stringify(data));
                    mx.ui.action(onClickMicroflow, {
                        params: { applyto: "selection", guids: [ object.getGuid() ] },
                        error: error => window.mx.ui.error(`Error executing on click microflow ${onClickMicroflow} : ${error.message}`)
                    });
                },
                error: error => window.mx.ui.error(`Error creating event entity ${eventEntity} : ${error.message}`)
            });
        }

        if (onClickNanoflow.nanoflow) {
            const context = new mendix.lib.MxContext();
            mx.data.create({
                entity: eventEntity,
                callback: object => {
                    object.set(eventDataAttribute, JSON.stringify(data));
                    context.setContext(eventEntity, object.getGuid());
                    mx.data.callNanoflow({
                        context,
                        error: error => mx.ui.error(`Error executing nanoflow ${onClickNanoflow} : ${error.message}`),
                        nanoflow: onClickNanoflow,
                        origin: mxform
                    });
                },
                error: error => window.mx.ui.error(`Error creating event entity ${eventEntity} : ${error.message}`)
            });
        }
    }

    private onHover = (data: any, tooltipNode: HTMLDivElement) => {
        const { eventEntity, eventDataAttribute, tooltipForm, tooltipMicroflow, tooltipEntity } = this.props;
        if (eventEntity && eventDataAttribute && tooltipForm && tooltipMicroflow && tooltipEntity) {
            mx.data.create({
                entity: eventEntity,
                callback: object => {
                    object.set(eventDataAttribute, JSON.stringify(data));
                    mx.ui.action(tooltipMicroflow, {
                        callback: (toolTipObjects: mendix.lib.MxObject[]) => this.openTooltipForm(tooltipNode, tooltipForm, toolTipObjects[0]),
                        params: { applyto: "selection", guids: [ object.getGuid() ] },
                        error: error => window.mx.ui.error(`Error executing on hover microflow ${tooltipMicroflow} : ${error.message}`)
                    });
                },
                error: error => window.mx.ui.error(`Error creating event entity ${eventEntity} : ${error.message}`)
            });
        }
    }

    private openTooltipForm(domNode: HTMLDivElement, tooltipForm: string, dataObject: mendix.lib.MxObject) {
        const context = new mendix.lib.MxContext();
        context.setContext(dataObject.getEntity(), dataObject.getGuid());
        window.mx.ui.openForm(tooltipForm, { domNode, context, location: "node" });
    }

    public static validateSeriesProps(props: AnyChartContainerProps): ReactChild {
        const errorMessages: string[] = [];

        if (props.layoutStatic && props.layoutStatic.trim()) {
            const error = validateAdvancedOptions(props.layoutStatic.trim());
            if (error) {
                errorMessages.push(`Invalid static layout JSON: ${error}`);
            }
        }
        if (props.dataStatic && props.dataStatic.trim()) {
            const error = validateAdvancedOptions(props.dataStatic.trim());
            if (error) {
                errorMessages.push(`Invalid static data JSON: ${error}`);
            }
        }
        const hasEvent = props.eventEntity && props.eventDataAttribute;
        if (props.tooltipForm && !hasEvent) {
            errorMessages.push("A tooltip requires event entity and event data attribute");
        }
        if (props.tooltipForm && props.tooltipMicroflow) {
            errorMessages.push("A tooltip requires a tooltip microflow");
        }
        if (props.onClickMicroflow && !hasEvent) {
            errorMessages.push("On click microflow requires event entity and event data attribute");
        }
        // TODO can we validate the context object of tooltip form to match the tooltip entity?

        return renderError(props.friendlyId, errorMessages);
    }
}

const mapStateToProps: MapStateToProps<AnyChartInstanceState, AnyChartContainerProps, ReduxStore> = (state, props) =>
    state.any[props.friendlyId] || defaultInstanceState as AnyChartInstanceState;
const mapDispatchToProps: MapDispatchToProps<typeof AnyChartActions & typeof PlotlyChartActions, AnyChartContainerProps> =
    dispatch => ({
        ...bindActionCreators(AnyChartActions, dispatch),
        ...bindActionCreators(PlotlyChartActions, dispatch)
    });
export default connect(mapStateToProps, mapDispatchToProps)(AnyChartDataHandler);
