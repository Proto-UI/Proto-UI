import type { ComponentProps, ComponentRef } from 'react';

import {
  ShadcnButton as ReactShadcnButton,
  BaseImageRoot as ReactBaseImageRoot,
} from './proto-ui/components/react';
import {
  ShadcnButton as VueShadcnButton,
  BaseImageRoot as VueBaseImageRoot,
} from './proto-ui/components/vue';
import { ShadcnButtonElement, BaseImageRootElement } from './proto-ui/components/wc';

type ReactButtonProps = ComponentProps<typeof ReactShadcnButton>;
type ReactButtonHandle = ComponentRef<typeof ReactShadcnButton>;

const reactValid: ReactButtonProps = { variant: 'outline', size: 'sm', disabled: true };
// @ts-expect-error Packed React facade must preserve the declared variant union.
const reactInvalidVariant: ReactButtonProps = { variant: 'not-a-variant' };
// @ts-expect-error Packed React facade must not accept unknown props through `any`.
const reactInvalidProp: ReactButtonProps = { unknownProtoProp: true };
declare const reactHandle: ReactButtonHandle;
const reactDisabled: boolean = reactHandle.getExposes().disabled.get();

type VueButtonInstance = InstanceType<typeof VueShadcnButton>;
type VueButtonProps = VueButtonInstance['$props'];

const vueValid: VueButtonProps = { variant: 'outline', size: 'sm', disabled: true };
// @ts-expect-error Packed Vue facade must preserve the declared variant union.
const vueInvalidVariant: VueButtonProps = { variant: 'not-a-variant' };
// @ts-expect-error Packed Vue facade must not accept unknown props through `any`.
const vueInvalidProp: VueButtonProps = { unknownProtoProp: true };
declare const vueInstance: VueButtonInstance;
const vueDisabled: boolean = vueInstance.getExposes().disabled.get();

type WebComponentButton = InstanceType<typeof ShadcnButtonElement>;
type WebComponentButtonProps = NonNullable<WebComponentButton['__protoUiProps']>;

const webComponentValid: WebComponentButtonProps = {
  variant: 'outline',
  size: 'sm',
  disabled: true,
};
// @ts-expect-error Packed Web Component facade must preserve the declared variant union.
const webComponentInvalidVariant: WebComponentButtonProps = { variant: 'not-a-variant' };
// @ts-expect-error Packed Web Component facade must not accept unknown props through `any`.
const webComponentInvalidProp: WebComponentButtonProps = { unknownProtoProp: true };
declare const webComponentElement: WebComponentButton;
const webComponentDisabled: boolean = webComponentElement.getExposes().disabled.get();

type ReactImageProps = ComponentProps<typeof ReactBaseImageRoot>;
type VueImageProps = InstanceType<typeof VueBaseImageRoot>['$props'];
type WebComponentImageProps = NonNullable<
  InstanceType<typeof BaseImageRootElement>['__protoUiProps']
>;

const imageValid: ReactImageProps & VueImageProps & WebComponentImageProps = {
  source: 'image:consumer',
  a11yMode: 'informative',
  alternativeText: 'Packed image',
  fit: 'cover',
};
// @ts-expect-error Packed React Image facade must preserve the fit union.
const reactInvalidFit: ReactImageProps = { fit: 'stretch' };
// @ts-expect-error Packed Vue Image facade must preserve the fit union.
const vueInvalidFit: VueImageProps = { fit: 'stretch' };
// @ts-expect-error Packed Web Component Image facade must preserve the fit union.
const webComponentInvalidFit: WebComponentImageProps = { fit: 'stretch' };

declare const reactImage: ComponentRef<typeof ReactBaseImageRoot>;
declare const vueImage: InstanceType<typeof VueBaseImageRoot>;
declare const webComponentImage: InstanceType<typeof BaseImageRootElement>;
type ImageStatus = 'idle' | 'loading' | 'loaded' | 'error';
const imageStatuses: ImageStatus[] = [
  reactImage.getExposes().loadingStatus.get(),
  vueImage.getExposes().loadingStatus.get(),
  webComponentImage.getExposes().loadingStatus.get(),
];

void reactValid;
void reactInvalidVariant;
void reactInvalidProp;
void reactDisabled;
void vueValid;
void vueInvalidVariant;
void vueInvalidProp;
void vueDisabled;
void webComponentValid;
void webComponentInvalidVariant;
void webComponentInvalidProp;
void webComponentDisabled;
void imageValid;
void reactInvalidFit;
void vueInvalidFit;
void webComponentInvalidFit;
void imageStatuses;
