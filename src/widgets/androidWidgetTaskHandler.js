import React from 'react';
import { loadWidgetSnapshot, WIDGET_NAME } from '../services/widgetService';
import { KoshAndroidWidget } from './KoshAndroidWidget';

export async function androidWidgetTaskHandler(props) {
  const widgetInfo = props?.widgetInfo;
  if (!widgetInfo || (widgetInfo.widgetName && widgetInfo.widgetName !== WIDGET_NAME)) {
    return;
  }

  switch (props.widgetAction) {
    case 'WIDGET_ADDED':
    case 'WIDGET_UPDATE':
    case 'WIDGET_RESIZED': {
      const snapshot = await loadWidgetSnapshot();
      props.renderWidget(
        <KoshAndroidWidget
          snapshot={snapshot}
          width={widgetInfo.width}
          height={widgetInfo.height}
        />
      );
      break;
    }
    case 'WIDGET_DELETED':
    case 'WIDGET_CLICK':
    default:
      break;
  }
}

export default androidWidgetTaskHandler;
