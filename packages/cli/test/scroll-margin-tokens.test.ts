import {expect,it} from 'vitest';
import {FeedbackStyleRecorder,tw} from '@proto.ui/core';
import {mergeTwTokensV0} from '../../core/src/spec/feedback/semantic-merge';
import {classifyTwTokenApplicationRoleV0} from '../../core/src/spec/feedback/application-role';
import {renderProtoStyleTokenCss,renderProtoShadowStyleArtifact,renderProtoShadowSplitStyleArtifact} from '../src/services/proto-style-css';
it.each([['scroll-my-1','0.25rem'],['scroll-my-1.5','0.375rem']])('lowers only finite block scroll margin %s across three targets',(token,value)=>{
 const recorder=new FeedbackStyleRecorder();recorder.use(tw(token));expect(recorder.export().tokens).toEqual([token]);
 expect(classifyTwTokenApplicationRoleV0(token)).toEqual({token,role:'placement',roleSource:'canonical'});
 const split=renderProtoShadowSplitStyleArtifact([token],{rootTokens:[token],templateTokens:[]}).cssText;
 for(const css of [renderProtoStyleTokenCss([token]),renderProtoShadowStyleArtifact([token]).cssText,split]){expect(css).toContain(`scroll-margin-block: ${value};`);expect(css).not.toContain('Unsupported Proto UI style tokens');}
 expect(split).toContain(`:host([data-pui-split-root-style~="${token}"])`);
});
it('uses one finite contribution group without absorbing unknown scroll margins',()=>{
 expect(mergeTwTokensV0(['scroll-my-1','scroll-my-1.5']).tokens).toEqual(['scroll-my-1.5']);expect(mergeTwTokensV0(['scroll-my-1.5','scroll-my-1']).tokens).toEqual(['scroll-my-1']);expect(mergeTwTokensV0(['scroll-my-1','scroll-my-2']).tokens).toEqual(['scroll-my-1','scroll-my-2']);
});
it.each(['scroll-my-2','scroll-my-[6px]','scroll-my-1.50','scroll-mx-1.5'])('does not infer unsupported %s',token=>{
 for(const css of [renderProtoStyleTokenCss([token]),renderProtoShadowStyleArtifact([token]).cssText,renderProtoShadowSplitStyleArtifact([token]).cssText])expect(css).toContain(`* - ${token}`);
});
